from flask import Flask, render_template, request, jsonify

app = Flask(__name__)

@app.route('/')
def home():
    return render_template('index.html')


@app.route('/modules')
def modules():
    return render_template('modules.html')

@app.route('/create_module_overlay')
def create_module_overlay():
    return render_template('module_overlay_create.html')

if __name__ == '__main__':
    app.run()