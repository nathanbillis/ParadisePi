// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// No Node.js APIs are available in this process because
// `nodeIntegration` is turned off. Use `preload.js` to
// selectively enable features needed in the rendering
// process.

/**
 * generic function to send an sACN call.
 * @param universe - int - universe number
 * @param channels - object - channels to update in form {channel:dmxValue}
 */
function sendACN(universe, channels){
    if (locked) {
        modalShow("lockedWarning");
        return false;
    }
    window.api.send("sendACN", {"universe":universe, "channelsValues": channels})
}
/**
 * generic function to send an OSC call
 * @param command - string - osc command to send
 * @param args - array - osc arguments
 */
function sendOSC(command, args = []) {
    if (locked) {
        modalShow("lockedWarning");
        return false;
    }
    window.api.send("sendOSC", {"command": command, "commandArgs": args})
}

/**
 * generic function to change tab view
 * @param tab - int - tab to select
 */
function changeTab(tab) {
    $(".tab[data-tab]").hide();
    $(".tab[data-tab='" + tab + "']").show();
    $("#menu td.selected").removeClass( "selected" );
    $("#menu td[data-tab='" + tab + "']").addClass( "selected" );
}
/*

 */
function modalShow(id) {
    $("#"+id).css("display", "block");
    var timeout = $("#"+id).data("timeout");
    clearTimeout(modalTimeouts[id]);
    if (timeout === 0) { //0 is infinite
        timeout = false;
    } else if (!isNaN(timeout)) {
        timeout = timeout*1000;
    } else {
        timeout = 5000;
    }
    if (timeout) {
        modalTimeouts[id] = setTimeout(function() {
            //Close the modal after 5 seconds
            $("#"+id).hide();
        }, timeout);
    }
}
/**
 * generic function triggered by frontend JS on the admin tab
 */
function adminFunctions(type) {
    switch (type) {
        case 'lock':
            window.api.asyncSend("toggleLock", {}).then((result) => {
            });
            break;
        case 'reboot':
            window.api.send("reboot", {});
            break;
        case 'exit':
            window.api.send("exit", {});
            break;
        case 'devTools':
            window.api.send("devTools", {});
            break;
    }
}
/**
 * button click function for LX
 */
function lxPreset (id) {
    window.api.asyncSend("simpleQueryDB", {"tableName": "lxPreset","keyName": "id", "value":id}).then((result) => {
        if (result.length == 1) {
            result = result[0];
            if (result.enabled) {
                sendACN(result.universe, JSON.parse(result["setArguments"]));
            }
        }
    });
}

function soundPreset (id) {
    window.api.asyncSend("simpleQueryDB", {"tableName": "sndPreset","keyName": "id", "value":id}).then((result) => {
        if (result.length == 1) {
            result = result[0];
            if (result.enabled) {
                var data = JSON.parse(result['data']);
                for (const [key, value] of Object.entries(data)) {
                    sendOSC(key, [value]);
                }
            }
        }
    });
}
window.api.receive("OSCStatus", (status) => {
    if (status) {
        $("#SNDStatusIcon").css("color","#6bf76b");
    } else {
        $("#SNDStatusIcon").css("color","#f74e4e");
    }
});
window.api.receive("fromOSC", (data) => {
    //The big old function that parses all data that ever makes it through from the desk
    let addressArray = data.address.split("/")
    //check split address to make sure it's a fader update
    if (data.address == "/info") {
        $("#SNDStatusDetails").html("Sound connected to " + data.args[2] + " " + data.args[3] + " (" + data.args[1] + " - " + data.args[0] + ")");
        $("#SNDStatusIcon").html(data.args[2] + " &#x25cf;");
    } else if (data.address == "/status") {
        console.log(data.args);
    } else if (addressArray[1] === "ch" && addressArray[3] === "mix" && addressArray[4] === "fader") {
        $(".fader").each(function(key, fader) {
            if( String(this.getAttribute("data-channel")).padStart(2, '0') === addressArray[2]) {
                fader.value = data.args[0];
            }
        })
    } else if (addressArray[1] === "ch" && addressArray[3] === "mix" && addressArray[4] === "on") {
        $(".channel-toggle").each(function (key, button) {
            if(String(this.getAttribute("data-channel")).padStart(2, '0') === addressArray[2]) {
                console.log(data.args[0]);
                toggleMute(this, data.args[0]);
            }
        });
    } else if (data.address == "/main/st/mix/fader") {
        $(".fader[data-channel='master']").val(data.args[0]);
    } else if (data.address == "/main/st/mix/on") {
        let master = $(".channel-toggle[data-channel='master']")
        if (data.args[0] == 1){
            master.addClass("unmute");
            master.removeClass("mute");
        } else {
            master.addClass("mute");
            master.removeClass("unmute");
        }
    }
});

var timeout = { //Black the screen after a timeout
    lastMove: (new Date()).getTime(),
    timeoutTime: 300000, //5 minutes = Default
    timedOut: false
};
var tab;
var modalTimeouts = {};
var locked = false;
$(document).ready(function() {
    //create buttons dynamically
    window.api.asyncSend("simpleQueryDB", {"tableName": "lxPreset"}).then((result) => {
        $.each(result, function (key,value) {
            $("#lxContainer").append('<button type="button" class="lx" data-preset="'+ (value.id) +'">' + value.name +'</button>');
        });
    });
    window.api.asyncSend("simpleQueryDB", {"tableName": "sndPreset"}).then((result) => {
        $.each(result, function (key,value) {
            $("#sndContainer").append('<button type="button" class="snd" data-preset="' + (value.id) + '">' + value.name +'</button>');
        });
    });

    //create Faders dynamically
    window.api.asyncSend("simpleQueryDB", {"tableName": "sndFaders"}).then((result) => {
        $.each(result, function (key,value) {
            $("#sndFaders").append('<div class="channel">\n' +
                '            <label>' + value.name + '</label><br/>\n' +
                '            <input class="fader" type="range" max="1" step="0.01" data-channel="' + value.channel + '" ' + (value.enabled ? '':'disabled') + ' value="0">\n' +
                '            <button class="channel-toggle unMuted" data-channel="' + value.channel + '" data-status="1"  ' + (value.enabled ? '':'disabled') + ' >Mute</button>\n' +
                '          </div>');
        });
        $("#sndFaders").append('<div class="channel">\n' +
            '            <label>Master</label><br/>\n' +
            '            <input class="fader" type="range" max="1" step="0.01" data-channel="master" disabled value="0">\n' +
            '            <button class="channel-toggle unmute" data-channel="master" data-status="1" disabled>Mute</button>\n' +
            '          </div>');
    });

    //setup all bindings/handlers
    $(document).on("click",".snd",function() {
        soundPreset($(this).data("preset"));
    });
    $(document).on("click",".lx",function() {
        lxPreset($(this).data("preset"));
    });
    $(document).on("click",".reboot",function() {
        window.api.send("reboot", {});
    });
    window.api.asyncSend("getConfig", {}).then((result) => {
        locked = (result['MAINConfig']['deviceLock'] === "LOCKED");
        if (locked) {
            $("#lockIcon").show();
            $("#deviceLockButton").html('Unlock');
        } else {
            $("#lockIcon").hide();
            $("#deviceLockButton").html('Lock');
        }
        timeout['timeoutTime'] = result['MAINConfig']['timeoutTime']*60*1000;
    });
    $("#allOff").click(function() {
        window.api.send("fadeAll");
        sndFadeAll();
        modalShow("allOffModal");
    });
    //Channel Fader handlimg
    //handle fader movement
    $(document).on('input', '.fader', function() {
        sendOSC("/ch/" + String(this.getAttribute("data-channel")).padStart(2, '0') + "/mix/fader", {type:"f", value:this.value});
    });
    //handle button toggle
    $(document).on("click", ".channel-toggle", function () {
        let  status = this.getAttribute("data-status")
        sendOSC("/ch/" + String(this.getAttribute("data-channel")).padStart(2, '0') + "/mix/on", {type: "i", value:status});
        toggleMute(this, status)
    });
    $(document).on("mousemove", function () {
        timeout["lastMove"] = (new Date()).getTime();
        if (timeout['timedOut']) {
            timeout['timedOut'] = false;
            $("#page").show();
        }
    });
    changeTab(1);
    $(document).on("click", "#menu td[data-tab]", function () {
        changeTab($(this).data("tab"));
    });
    window.api.asyncSend("getIP", {}).then((result) => {
        let url = "http://" + result + ":8080"
        new QRCode(document.getElementById("adminQRCode"), {
            text: url,
            width: 200,
            height: 200,
            colorDark : "#000000",
            colorLight : "#d6dfde"
        });
        $("#adminURL").html(url);
    });
    //Modals
    $(document).on("click", "span.close", function () {
        $(this).parents(".modal").hide();
    });
});
setInterval(function() {
    if (!timeout['timedOut'] && (timeout['lastMove']+timeout['timeoutTime']) <= (new Date()).getTime()) {
        $("#page").fadeOut(5000);
        timeout['timedOut'] = true;
    }
}, 1000);

async function sndFadeAll(){
    let faders = $(".fader");
    let changedZero = true;
    while(changedZero){
        changedZero = false;
        faders.each( function (){
            if (this.value > 0){
                changedZero = true;
                this.value -= 0.01;
                sendOSC("/ch/" + String(this.getAttribute("data-channel")).padStart(2, '0') + "/mix/fader", {type:"f", value:this.value});
            }
        });
        await new Promise(r => setTimeout(r, 30));
    }
}

function toggleMute(element, status){
    if (status == 1) {
        element.setAttribute("data-status", 0);
        element.classList.add("unmute");
        element.classList.remove("mute");
    } else {
        element.setAttribute("data-status", 1);
        element.classList.add("mute");
        element.classList.remove("unmute");
    }
}