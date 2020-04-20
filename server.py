from flask import Flask, render_template
from flask_socketio import SocketIO, emit

app = Flask(__name__)
app.debug = True
socketio = SocketIO(app)

@app.route('/')
def index():
    return render_template('index.html')

@socketio.on('button_clicked', namespace='/socket_space')
def test_message(message):
    print(message)
    emit('my response', {'respy': message['crazy']})

@socketio.on('my broadcast event', namespace='/socket_space')
def test_message(message):
    emit('my response', {'data': message['data']}, broadcast=True)

@socketio.on('connect', namespace='/socket_space')
def test_connect():
    print(request.args.get("name"))
    emit('my response', {'data': 'Connected'})

@socketio.on('disconnect', namespace='/socket_space')
def test_disconnect():
    print('Client disconnected')

if __name__ == '__main__':
    socketio.run(app)
