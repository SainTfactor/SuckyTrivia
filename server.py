from flask import Flask, render_template, session, request
from flask_socketio import SocketIO, emit, send, join_room, leave_room

app = Flask(__name__)
app.secret_key = "Eff da police, this be temporary."
app.debug = True
socketio = SocketIO(app)

users = []

@app.route('/')
def index():
    print(repr(request.args))
    session["room_id"] = request.args.get("q")
    return render_template('index.html')

@socketio.on('button_clicked', namespace='/socket_space')
def test_message(message):
    emit('hit_u_bak', {'respy': message['crazy']})

        
@socketio.on('join', namespace='/socket_space')
def on_join(data):
    username = data['username']
    room = data['room']
    join_room(room)
    print("Joining up!")
    print(room)
    send(username + ' has entered the room.', room=room)

@socketio.on('leave', namespace='/socket_space')
def on_leave(data):
    username = data['username']
    room = data['room']
    leave_room(room)
    send(username + ' has left the room.', room=room)
    
@socketio.on('connect', namespace='/socket_space')
def test_connect():
    
    emit('my response', {'data': 'Connected'})

@socketio.on('disconnect', namespace='/socket_space')
def test_disconnect():
    print('Client disconnected')

if __name__ == '__main__':
    socketio.run(app)
