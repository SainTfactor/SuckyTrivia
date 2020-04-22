from flask import Flask, render_template, session, request
from flask_socketio import SocketIO, emit, send, join_room, leave_room
from flask_session import Session
from flask_cors import CORS
from functools import wraps
import uuid
import datetime

app = Flask(__name__)
app.secret_key = "Eff da police, this be temporary."
Session(app)
CORS(app)
socketio = SocketIO(app)

@app.before_request
def before_request():
    for i in session:
        print(i)
        print(session[i])
    session.permanent = True
    app.permanent_session_lifetime = datetime.timedelta(days=1)
    session.modified = True

@app.route('/')
def index():
    return render_template('index.html')

@socketio.on('start_game', namespace='/socket_space')
def start_game(message):
    session["username"] = message["gm_name"]
    session["room"] = message["room_code"]
    join_room(message["room_code"])
    join_room("gm-{}".format(message["room_code"]))
        
@socketio.on('join', namespace='/socket_space')
def on_join(data):
    if data["guid"] == "new":
        session["guid"] = str(uuid.uuid4())
    session["username"] = data['username']
    session["room"] = data['room']
    join_room(data["room"])
    emit("player_join", { "name" : data['username'], "guid" : session["guid"] }, room="gm-{}".format(data["room"]))
    send(data["username"] + ' has entered the room.', room=data["room"])
    
@socketio.on('leave', namespace='/socket_space')
def on_leave():
    send(session["username"] + ' has left the room.', room=session["room"])
    leave_room(session["room"])
    session.clear()
    session.modified = True

@socketio.on('get_session', namespace='/socket_space')
def get_session():
    tmp_room = str(uuid.uuid4())
    join_room(tmp_room)
    for i in session:
        print(i)
        print(session[i])
    emit("get_session", { "username" : session.get("username"), "room" : session.get("room"), "guid" : session.get("guid") }, room=tmp_room)
    leave_room(tmp_room)
    
@socketio.on('answer_update', namespace='/socket_space')
def answer(data):
    for i in session:
        print(i)
        print(session[i])
    emit("push_answer", { "guid" : session["guid"], "answer" : data }, room="gm-{}".format(session["room"]))

@socketio.on('connect', namespace='/socket_space')
def connect():
    emit('my response', {'data': 'Connected'})

@socketio.on('disconnect', namespace='/socket_space')
def disconnect():
    for i in session:
        print(i)
        print(session[i])
    print('Client disconnected')

if __name__ == '__main__':
    socketio.run(app)
