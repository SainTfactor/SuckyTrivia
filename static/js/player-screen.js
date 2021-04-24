var player_screen = {
    data: function(){
        return {
            question: "",
            answer: "",
            guess: "",
            button_text: "Lock Answer",
            locked: false
        }
    },
    methods: {
        lock_answer: function (socket) {
            this.locked = true;
            this.button_text = 'LOCKED';
            socket.emit('answer_locked');
        }
    }, 
    mounted: function() {
        console.log("mount 6")
    }
}