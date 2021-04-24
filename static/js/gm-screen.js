var gm_screen = {
  props: [ "question_tree", 'game_started', 'roomcode' ],
  data: function(){
    return {
    }
  },
  methods: {
    unlock_user: function(player){
        
    }
  }, 
  mounted: function() {
    var self = this;
    console.log("mount 2")

    socket.off('player_join')
    socket.on('player_join', function (data, cb) {
      if (!self.question_tree.players.some(function (val) {
              return data.name == val.name;
          })) {
          self.question_tree.players.push(data);
      } else if (self.question_tree.players.some(function (val) {
              return data.name == val.name && val.guid == "";
          })) {
          self.question_tree.players.filter(function (val) { return data.name == val.name && val.guid == ""; })[0].guid = data.guid;
          self.question_tree.questions.forEach(function(val){
              val.player_answers.forEach(function(val2) {
                  if (val2.player == ("dead_user-" + data.name)) {
                      val2.player = data.guid; 
                  }
              });
          });
      }
      if (self.question_tree.current_question != -1) {
        send_question(self.question_tree);
        if (self.question_tree.questions[self.question_tree.current_question].answer_shown && 
          !self.question_tree.questions[self.question_tree.current_question].round_header) {
          send_answer(self.question_tree);
        }
      }
      save_state(self.question_tree);
    });


  }
}