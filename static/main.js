gen_room_code = function() {
	return Math.random().toString(36).replace(/[^a-z]+/g, '').substr(0, 5).toUpperCase();
}

show_screen = function(screen_name) {
    $(".game_screen").css("display", "none");
    $("#" + screen_name).css("display", "block");
}

$(document).ready(function() {
    var socket = io.connect('http://trivia.saintfactorstudios.ml/socket_space');

    socket.on('message', function(data, cb) {
        console.log(data);
    });

    $("#new_btn").on("click", function(){
        room_code = gen_room_code();
        $("#room_code").html(room_code);
        socket.emit('start_game', { gm_name: "Cookie Masterson", room_code: room_code});
        show_screen("gm_screen");
            
        function GameViewModel() {
            var self = this;

            self.players = ko.observableArray([]);

            socket.on("player_join", function(data, cb){
                if(!self.players().some(function(val) { return data.name == val.name; })){
                    self.players.push(data);
                }
            });

            socket.on("push_answer", function(data, cb) {
                console.log("data caught")
                $("#" + data.guid).html(data.answer)
            });
        }
        ko.applyBindings(new GameViewModel());
    });

    $("#join_btn").on("click", function(){
        show_screen("player_connect_screen");
    });

    $('#join_game').on("click", function() {
        console.log("Sending join request")
        socket.emit('join', {username: $("#player_username").val(), room: $("#join_room_code").val()});
        show_screen("player_game_screen");
    });

    timeout = null;
    post_current_answer = function() {
      socket.emit('answer_update', $("#answer_input").val())  
    }
    $("#answer_input").on("keyup", function() {
       clearTimeout(timeout);
           timeout = setTimeout(post_current_answer, 300);
    });
});
