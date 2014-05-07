var ks_oldkey;
var ks_action;
var ks_id = 0;

$(document).ready(function() {

	// initialize a dialog window
	$('#keyboard_shortcuts_help').dialog({
		autoOpen: false,
		draggable: true,
		modal: false,
		resizable: false,
		width: 750,
		title: rcmail.gettext("keyboard_shortcuts")
	});

    if(rcmail.env.action == 'edit-prefs') {
	   $('form').on('focus', '.key', function(e) {
	       ks_record_key($(this),e);
	   }).select(function(e) {
           // roundcube auto selects, which looks ugly and causes problems
           return false;
       });

       // click on remove icon
       $('.ks_content').on('click', 'a.button.ks_del', function(e) {
           $(this).closest('tr').remove();
       });

       // click on add icon
       $('.ks_content').on('click', 'a.button.ks_add', function(e) {
           ks_add_input($(this));
       });

    } else {
        $(document).keypress(function (e) {
            return ks_key_pressed(e);
        });
    }
});

function ks_add_input (e) {
    var cur_section;

    // get current section
    cur_section = e.attr('data-section');

    var tr = $('<tr><td class="title"><select name="_ks_command['+cur_section+']" /></td><td><input name="_ks_ascii['+cur_section+'][]" class="rcmfd_ks_input key" type="text" autocomplete="off" value="" data-section="'+cur_section+'" data-id="new'+ks_id+'"><input type="hidden" name="_ks_keycode['+cur_section+'][]" value="" class="keycode" data-section="'+cur_section+'" data-id="new'+ks_id+'"><a class="button ks_del"></a></td></tr>');

    // create command select box
    var select = tr.find('select');
    for(var section in keyboard_shortcuts_commands) {
        if(section == 'global' || section == cur_section) {
            for(var command in keyboard_shortcuts_commands[section]) {
                // set label
                var label = rcmail.get_label(command, 'keyboard_shortcuts');

                // see if we have set a specific label to override
                if(typeof keyboard_shortcuts_commands[section][command] == 'object') {
                    if(keyboard_shortcuts_commands[section][command].label) {
                       label = rcmail.get_label(keyboard_shortcuts_commands[section][command].label, 'keyboard_shortcuts');
                    }
                }
                $("<option />", {value: command, text: label}).appendTo(select);
            }
        }
    }
    e.closest('tr').before(tr);
    return;

}

/**
 * key was pressed, handle the key and run command
 * @param  {object} e
 * @return {boolean}
 */
function ks_key_pressed (e) {
    var action;
    var keycode;
    var commands = {};

    // special case. If we hit ctrl-enter, and we're composing, and we have focus, then send email
    if (rcmail.env.action == 'compose' && (e.which == 13 || e.which == 10) && e.ctrlKey && $("*:focus").is("#composebody")) {
        $('.button.send').click();
        return false;
    }

    // check if some element has focus. If it does, skip this plugin.
    if ( $("*:focus").is("textarea, input") ) return true;

    // we dont support meta keys;
    if (e.ctrlKey || e.metaKey) return true;

    // find the current action
    if (rcmail.env.action === '' || rcmail.env.action == 'preview')
        ks_action = 'mailbox';
    else
        ks_action = rcmail.env.action;

    // check the key we pressed
    keycode = ks_handle_key(e);

    // check the command arrays for a match
    if(typeof keyboard_shortcuts === 'object') {
        if(ks_action in keyboard_shortcuts && keycode in keyboard_shortcuts[ks_action]) {
            ks_run(keyboard_shortcuts[ks_action][keycode]);
        } else if(keycode in keyboard_shortcuts.global) {
            ks_run(keyboard_shortcuts.global[keycode]);
        }
    }

    e.preventDefault();
    return false;
}

/**
 * run a command, either an internal command, or an external function
 * @param  {string} command
 * @return {}
 */
function ks_run(command) {
    if(rcmail.commands[command]) {
        rcmail.command(command);
    } else if(typeof window[command] === 'function') {
        window[command]();
    } else {
        // we cant find a function that matches this
    }
}

/**
 * record a key press in settings
 * @param  {object} input jquery input object
 * @param  {object} e     keypress event
 * @return {boolean}
 */
function ks_record_key(input,e) {

    var disallowed_keys = {
        10:'return',
        13:'return',
        32:'space'
    };

    // if we're recording, cancel all previous recordings
    ks_reset_recording();

    // save old key
    ks_oldkey = input.val();

    // set new recording
    input.attr('recording', 'true');

    // empty input
    input.val('');

    // ask for new key
    input.keypress(function(i) {
        var keycode, char;

        // dont allow these keys
        if(i.which in keyboard_shortcuts_disallowed_keys) {
            rcmail.display_message(rcmail.gettext('invalidkey', 'keyboard_shortcuts'), 'warning', 1500);
            ks_reset_recording();
            i.preventDefault();
            return true;
        }

        // check which key we pressed
        if((keycode = ks_handle_key(i)) === false) {
            rcmail.display_message(rcmail.gettext('invalidkey', 'keyboard_shortcuts'), 'warning', 1500);
            ks_reset_recording();
            i.preventDefault();
            return true;
        }

        // check if the key exists
        if(ks_key_exists(keycode, input)) {
            rcmail.display_message(rcmail.gettext('keyexists', 'keyboard_shortcuts'), 'warning', 1500);
            ks_reset_recording();
            i.preventDefault();
            return true;
        }

        char = String.fromCharCode(keycode);

        i.preventDefault();

        input.val(char);
        input.parent().find('.keycode').val(keycode);

        $('.key').unbind('keypress')
                     .unbind('blur')
                     .removeAttr("recording")
                     .blur();

    });

    input.blur(function(i) {
        ks_reset_recording();
    });
}

/**
 * check if the key exists
 * @param  {string} keycode
 * @param  {object} input Jquery object
 * @return {boolean}
 */
function ks_key_exists(keycode, input) {
    var found = false, section, id;

    // current section
    section = input.attr('data-section');

    // current id
    id      = input.attr('data-id');

    // see if we have the same key in this section or in global
    input.closest('form').find("input.keycode[value='"+keycode+"']").each(function(e) {
        var cur_section, cur_id;

        cur_section = $(this).attr('data-section');
        cur_id      = $(this).attr('data-id');

        if(id != cur_id) {
            if(section == cur_section || cur_section == 'global') {
                found = true;
            }
        }
    });
    return found;
}

/**
 * check the key on the event
 * @param  {event} e
 * @return {string|false}
 */
function ks_handle_key(e) {
    if (e.which === null) {
       keycode = e.keyCode;
    } else if (e.which !==0 && e.charCode !== 0) {
       keycode = e.which;
    } else keycode = false;

    return keycode;
}

/**
 * reset the recording
 * @return {}
 */
function ks_reset_recording() {
    $(".key[recording='true']").val(ks_oldkey)
                                   .removeAttr('recording').blur();
}



/**
 * all plugin keyboard functions
 */


// show help
function ks_help() {
  keyboard_shortcuts_show_help();
}

// mark all visible messages as read
function ks_markallvisiblemessagesasread() {
	rcmail.command('select-all', 'page');
	rcmail.command('mark', 'read');
	rcmail.command('select-none');
}

// select all visible messages
function ks_selectallvisiblemessages() {
	rcmail.command('select-all', 'page');
}

// reply-all
function ks_replyall() {
	if (rcmail.message_list.selection.length == 1)
	rcmail.command('reply-all');
}

// reply
function ks_reply() {
	if (rcmail.message_list.selection.length == 1)
	rcmail.command('reply');
}

// select all on current page
function ks_select_all_on_page() {
	rcmail.command('select-all', 'page');
}

// forward a message
function ks_forward() {
	if (rcmail.message_list.selection.length == 1)
	rcmail.command('forward');
}

// print a message
function ks_print() {
	if (rcmail.message_list.selection.length == 1)
	rcmail.command('print');
}

// search
function ks_search() {
	$('#quicksearchbox').focus();
	$('#quicksearchbox').select();
}

function keyboard_shortcuts_show_help() {
  $('#keyboard_shortcuts_help').dialog('open');
}


