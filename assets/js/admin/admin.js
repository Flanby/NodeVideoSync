function setLoader() {
    $(".main-content").html('<div class="center"><i class="fas fa-football-ball loader"></i></div>');
}

function setError() {
    $(".main-content").html('<div class="center"><h1 class="errorAjax"><i class="fas fa-cogs"></i> Erreur <i class="fas fa-quidditch"></i></h1></div>');
}

var token = "";
$(function() {
    $(".sideMenu li a").click(function (e) {
        e.preventDefault();
        setLoader();
        
        $.ajax(this.href).done(function(data) {
            $(".main-content").html(data);
        }).fail(function() {
            setError();
        });

        return false;
    })
});