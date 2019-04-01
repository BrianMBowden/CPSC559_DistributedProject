$(document).ready((e) => {
    window.typeit = window.typeit || {};

    (function() {
        let self = this;

        self.init = function() {

            $('#login input[name="submit"]').click((e) => {
                window.typeit.login($('#login input[name="username"]').val(), $('#login input[name="password"]').val(), (err) => {
                    if (err) {
                        alert('invalid username/password');
                    } else {
                        $('#login').hide();
                        $('#doc').show();
                    }
                });
            });
        };

        self.login = function(username, password, callback) {
            console.log('sending login request');
            $.ajax({
                url: '/login',
                type: 'POST',
                data: {
                    username: username,
                    password: password
                },
                success: function() {
                    callback();
                },
                error: function(e) {
                    callback(e);
                }
            });
        };
    }).apply(window.typeit);


    console.log("Starting client...");
    typeit.init();
});
