$(document).ready((e) => {
    window.typeit = window.typeit || {};

    (function() {
        let self = this;

        self.init = function() {

            $('#login input[name="submit"]').click((e) => {
                window.typeit.login($('#login input[name="username"]').val(), $('#login input[name="password"]').val(), (err) => {
                    if (err) {
                        throw err;
                        // TODO: LOGIN FLOW
                    } else {
                        $('#login').hide();
                        $('#doc').show();
                    }
                });
            });
        };

        self.login = function(username, password, callback) {
            console.warn("not implemented");
            callback(null);
        };
    }).apply(window.typeit);


    console.log("Starting client...");
    typeit.init();
});
