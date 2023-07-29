from flask import Flask, render_template, request, jsonify, redirect, url_for, request
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.sql import func
from flask_migrate import Migrate

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///database.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)
migrate = Migrate(app, db)

class Module(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    created_at = db.Column(db.DateTime(timezone=True),
                           server_default=func.now())
    name = db.Column(db.String(128), nullable=False)
    functions = db.relationship('Function', backref='module', lazy=True)

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


@app.route('/')
def home():
    modules = Module.query.all()

    return render_template('index.html', modules=modules)


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
    modules = Module.query.all()

    return render_template('modules.html', modules=modules)


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
    # Create the module and add it to the database
    module = Module(name=module_name)
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


if __name__ == '__main__':
    app.run()