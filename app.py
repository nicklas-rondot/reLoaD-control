from flask import Flask, render_template, request, jsonify, redirect, url_for, request
from flask_sqlalchemy import SQLAlchemy
import os
import json
from sqlalchemy.sql import func
from flask_migrate import Migrate
from flask import Flask, redirect, request, url_for
from flask_login import (
    LoginManager,
    current_user,
    login_required,
    login_user,
    logout_user,
)
from oauthlib.oauth2 import WebApplicationClient
import requests
from flask_login import UserMixin
from dotenv import load_dotenv

load_dotenv()


app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY") or os.urandom(24)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///database.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)
migrate = Migrate(app, db)


GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", None)
GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET", None)
GOOGLE_DISCOVERY_URL = (
    "https://accounts.google.com/.well-known/openid-configuration"
)

login_manager = LoginManager()
login_manager.init_app(app)

client = WebApplicationClient(GOOGLE_CLIENT_ID)


class User(UserMixin, db.Model):
    id = db.Column(db.String(128), primary_key=True)
    name = db.Column(db.String(128), nullable=False)
    email = db.Column(db.String(128), nullable=False)
    profile_pic = db.Column(db.String(2048), nullable=False)
    modules = db.relationship('Module', backref='user', lazy=True)
    

class Module(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    created_at = db.Column(db.DateTime(timezone=True),
                           server_default=func.now())
    name = db.Column(db.String(128), nullable=False)
    functions = db.relationship('Function', backref='module', lazy=True)
    user_model_id = db.Column(db.String(128), db.ForeignKey('user.id'), nullable=False)

class Function(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    created_at = db.Column(db.DateTime(timezone=True),
                           server_default=func.now())
    method = db.Column(db.String(10), nullable=False)
    name = db.Column(db.String(128), nullable=False, server_default='default')
    variables = db.relationship('Variable', backref='function', lazy=True)
    module_id = db.Column(db.Integer, db.ForeignKey('module.id'), nullable=False)

class Variable(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    created_at = db.Column(db.DateTime(timezone=True),
                           server_default=func.now())
    name = db.Column(db.String(128), nullable=False, server_default='default')
    function_id = db.Column(db.Integer, db.ForeignKey('function.id'), nullable=False)


@login_manager.user_loader
def load_user(user_id):
    return User.query.get(user_id)


def get_google_provider_cfg():
    return requests.get(GOOGLE_DISCOVERY_URL).json()


@app.route("/login")
def login():

    # Find out what URL to hit for Google login
    google_provider_cfg = get_google_provider_cfg()
    authorization_endpoint = google_provider_cfg["authorization_endpoint"]

    # Use library to construct the request for Google login and provide
    # scopes that let you retrieve user's profile from Google
    request_uri = client.prepare_request_uri(
        authorization_endpoint,
        redirect_uri=request.base_url + "/callback",
        scope=["openid", "email", "profile"],
    )
    return redirect(request_uri)

@app.route("/login/callback")
def callback():
    # Get authorization code Google sent back to you
    code = request.args.get("code")
    # Find out what URL to hit to get tokens that allow you to ask for
    # things on behalf of a user
    google_provider_cfg = get_google_provider_cfg()
    token_endpoint = google_provider_cfg["token_endpoint"]
    # Prepare and send a request to get tokens! Yay tokens!
    token_url, headers, body = client.prepare_token_request(
        token_endpoint,
        authorization_response=request.url,
        redirect_url=request.base_url,
        code=code
    )
    token_response = requests.post(
        token_url,
        headers=headers,
        data=body,
        auth=(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET),
    )

    # Parse the tokens!
    client.parse_request_body_response(json.dumps(token_response.json()))
    # Now that you have tokens (yay) let's find and hit the URL
    # from Google that gives you the user's profile information,
    # including their Google profile image and email
    userinfo_endpoint = google_provider_cfg["userinfo_endpoint"]
    uri, headers, body = client.add_token(userinfo_endpoint)
    userinfo_response = requests.get(uri, headers=headers, data=body)
    # You want to make sure their email is verified.
    # The user authenticated with Google, authorized your
    # app, and now you've verified their email through Google!
    if userinfo_response.json().get("email_verified"):
        user_id = userinfo_response.json()["sub"]
        email = userinfo_response.json()["email"]
        picture = userinfo_response.json()["picture"]
        name = userinfo_response.json()["given_name"]
    else:
        return "User email not available or not verified by Google.", 400
    # Create a user in your db with the information provided
    # by Google
    user = User.query.get(user_id)
    print(user)

    # Doesn't exist? Add it to the database.
    if not user:
        user = User(id=user_id, name=name, email=email, profile_pic=picture)

    db.session.add(user)
    db.session.commit()

    # Begin user session by logging the user in
    login_user(user)

    # Send user back to homepage
    return redirect(url_for("index"))


@app.route("/logout")
@login_required
def logout():
    logout_user()
    return redirect(url_for("index"))


@app.route('/')
def index():
    if not current_user.is_authenticated:
        return '<a class="button" href="/login">Google Login</a>'
    modules = Module.query.all()
    context = {
        'modules': modules, 
        'current_user': current_user,
    }

    return render_template('index.html', context=context)


@app.route('/code_editor_overlay')
def code_editor_overlay():
    return render_template('code_editor_overlay.html')


@app.route('/show_add_action_overlay')
def show_add_action_overlay():
    module_str = request.args.get('module')
    module = Module.query.filter_by(name=module_str).first()

    return render_template('add_action_overlay.html', module=module)


@app.route('/add_function_variables')
def add_function_variables():
    function_str = request.args.get('function')
    function = Function.query.filter_by(name=function_str).first()

    return render_template('add_action_function_variables.html', function=function)


@app.route('/modules')
def modules():
    if not current_user.is_authenticated:
        return '<a class="button" href="/login">Google Login</a>'
    modules = Module.query.all()
    context = {
        'modules': modules, 
        'current_user': current_user,
    }

    return render_template('modules.html', context=context)


@app.route('/create_module_overlay')
def create_module_overlay():
    return render_template('module_overlay_create.html')


@app.route('/create_module_add_function')
def create_module_add_function():
    count = request.args.get('count')

    return render_template('module_add_function.html', functionCount=count)


@app.route('/create_module', methods=['POST'])
def create_module():
    # Get the data from the form
    module_name = request.form.get('name')
    if module_name == '':
        return redirect(url_for('modules'))
    # Create the module and add it to the database
    module = Module(name=module_name, user_model_id=current_user.id)
    db.session.add(module)
    db.session.commit()
    
    # Process the dynamic function and variable fields
    i = 1
    while True:
        # Get the method and variables from the current index
        name = request.form.get(f'name-{i}')
        method = request.form.get(f'method-{i}')
        variables_str = request.form.get(f'variables-{i}')

        # If either method or variables is missing, break out of the loop
        if not name or not method or not variables_str:
            break

        # Split variables string into a list of variables
        variables = variables_str.split(',')

        # Create the function and add it to the database
        function = Function(method=method, name=name, module=module)
        db.session.add(function)

        # Create the variables and add them to the database
        for variable_name in variables:
            variable = Variable(name=variable_name, function=function)
            db.session.add(variable)

        # Increment the counter for the next set of dynamic fields
        i += 1
    
    # Commit all changes to the database
    db.session.commit()
    
    return redirect(url_for('modules'))


@app.route('/edit_module_overlay')
def edit_module_overlay():
    module_str = request.args.get('module')
    module = Module.query.filter_by(name=module_str).first()

    return render_template('module_overlay_edit.html', module=module)



@app.route('/save_module', methods=['POST'])
def save_module():
    # Get the data from the form
    module_name = request.form.get('name')

    # Create the module and add it to the database
    module = Module.query.filter_by(name=module_name, user_model_id=current_user.id).first()

    old_function_names = [old_function.name for old_function in Function.query.filter_by(module=module)]
    new_function_names = []
    
    # Process the dynamic function and variable fields
    i = 1
    print(request.form)
    while True:
        # Get the method and variables from the current index
        name = request.form.get(f'name-{i}')
        method = request.form.get(f'method-{i}')
        variables_str = request.form.get(f'variables-{i}')

        # If either method or variables is missing, break out of the loop
        if not name or not method or not variables_str:
            break

        # Split variables string into a list of variables
        variables = variables_str.split(' ')

        # Create the function and add it to the database
        function = Function.query.filter_by(name=name, module=module).first()
        print(method)
        print(function)
        if function == None:
            function = Function(method=method, name=name, module=module)
        
        function.method = method
        new_function_names.append(function.name)

        db.session.add(function)

        old_variables = Variable.query.filter_by(function=function)
        old_variables.delete() 

        # Create the variables and add them to the database
        for variable_name in variables:
            if variable_name == '':
                break
            variable = Variable.query.filter_by(name=variable_name, function=function).first()
            if variable == None:
                variable = Variable(name=variable_name, function=function)
            db.session.add(variable)

        # Increment the counter for the next set of dynamic fields
        i += 1

    for old_function_name in old_function_names:
        if old_function_name not in new_function_names:
            Function.query.filter_by(name=old_function_name, module=module).delete()
    
    # Commit all changes to the database
    db.session.commit()
    
    return redirect(url_for('modules'))


@app.route('/delete_module', methods=['POST', 'GET'])
def delete_module():
    # Get the data from the form
    module_name = request.args.get('name')
    print(module_name)

    # Create the module and add it to the database
    module = Module.query.filter_by(name=module_name, user_model_id=current_user.id).first()
    functions = Function.query.filter_by(module_id=module.id)
    for function in functions:
        variables = Variable.query.filter_by(function_id=function.id)
        variables.delete()
    functions.delete()
    db.session.delete(module)

    db.session.commit()

    return redirect(url_for('modules'))


@app.route("/home")
@login_required
def home():
    context = {}
    return render_template('home.html', context=context)


if __name__ == '__main__':
    app.run(ssl_context="adhoc")