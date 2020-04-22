from flask import Flask, render_template, session, request
from flask_socketio import SocketIO, emit, send, join_room, leave_room
from functools import wraps
import uuid
import datetime

app = Flask(__name__)
app.secret_key = "Eff da police, this be temporary."
app.debug = True
socketio = SocketIO(app)

def keep_alive(f):
    @wraps(f)
    def wrapper(*args, **kwds):
        app.permanent_session_lifetime = datetime.timedelta(minutes=60)
        session.modified = True
        print("Keep away!!!!!!!!")
        return f(*args, **kwds)
    return wrapper

@app.before_request
def before_request():
    session.permanent = True
    app.permanent_session_lifetime = datetime.timedelta(minutes=60)
    session.modified = True

@app.route('/')
def index():
    return render_template('index.html')

@socketio.on('start_game', namespace='/socket_space')
@keep_alive
def test_message(message):
    session["username"] = message["gm_name"]
    session["room"] = message["room_code"]
    join_room(message["room_code"])
    join_room("gm-{}".format(message["room_code"]))
        
@socketio.on('join', namespace='/socket_space')
@keep_alive
def on_join(data):
    session["guid"] = str(uuid.uuid4())
    session["username"] = data['username']
    session["room"] = data['room']
    join_room(data["room"])
    emit("player_join", { "name" : data['username'], "guid" : session["guid"] }, room="gm-{}".format(data["room"]))
    send(data["username"] + ' has entered the room.', room=data["room"])

@socketio.on('answer_update', namespace='/socket_space')
@keep_alive
def answer(data):
    emit("push_answer", { "guid" : session["guid"], "answer" : data }, room="gm-{}".format(session["room"]))

@socketio.on('connect', namespace='/socket_space')
def test_connect():
    emit('my response', {'data': 'Connected'})

@socketio.on('disconnect', namespace='/socket_space')
def test_disconnect():
    print('Client disconnected')

if __name__ == '__main__':
    socketio.run(app)
