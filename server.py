from flask import Flask, render_template, session, request
from flask_socketio import SocketIO, emit, send, join_room, leave_room

app = Flask(__name__)
app.secret_key = "Eff da police, this be temporary."
app.debug = True
socketio = SocketIO(app)

users = []

@app.route('/')
def index():
    return render_template('index.html')

@socketio.on('start_game', namespace='/socket_space')
def test_message(message):
    session["username"] = message["gm_name"]
    session["room_id"] = message["room_id"]
    join_room(message["room_id"])
    join_room("gm-{}".format(message["room_id"]))
    emit('hit_u_bak', {'respy': message['crazy']})

        
@socketio.on('join', namespace='/socket_space')
def on_join(data):
    session["username"] = data['username']
    session["room"] = data['room']
    join_room(data["room"])
    emit("player_join", data['username'], room="gm-{}".format(data["room"]))
    send(data["username"] + ' has entered the room.', room=data["room"])
   
@socketio.on('connect', namespace='/socket_space')
def test_connect():
    emit('my response', {'data': 'Connected'})

@socketio.on('disconnect', namespace='/socket_space')
def test_disconnect():
    print('Client disconnected')

if __name__ == '__main__':
    socketio.run(app)
