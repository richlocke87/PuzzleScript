/*
credits

brunt of the work by stephen lavelle (www.increpare.com)

all open source mit license blah blah

testers:
none, yet

code used

colors used
color values for named colours from arne, mostly (and a couple from a 32-colour palette attributed to him)
http://androidarts.com/palette/16pal.htm

the editor is a slight modification of codemirro (codemirror.net), which is crazy awesome.

for post-launch credits, check out activty on github.com/increpare/PuzzleScript

*/

var compiling = false;
var errorStrings = [];
var errorCount=0;

function logErrorCacheable(str, lineNumber,urgent) {
    if (compiling||urgent) {
        if (lineNumber === undefined) {
            return logErrorNoLine(str);
        }
        var errorString = '<a onclick="jumpToLine(' + lineNumber.toString() + ');"  href="javascript:void(0);"><span class="errorTextLineNumber"> line ' + lineNumber.toString() + '</span></a> : ' + '<span class="errorText">' + str + '</span>';
         if (errorStrings.indexOf(errorString) >= 0 && !urgent) {
            //do nothing, duplicate error
         } else {
            consolePrint(errorString);
            errorStrings.push(errorString);
            errorCount++;
        }
    }
}

function logError(str, lineNumber,urgent) {
    if (compiling||urgent) {
        if (lineNumber === undefined) {
            return logErrorNoLine(str,urgent);
        }
        var errorString = '<a onclick="jumpToLine(' + lineNumber.toString() + ');"  href="javascript:void(0);"><span class="errorTextLineNumber"> line ' + lineNumber.toString() + '</span></a> : ' + '<span class="errorText">' + str + '</span>';
         if (errorStrings.indexOf(errorString) >= 0 && !urgent) {
            //do nothing, duplicate error
         } else {
            consolePrint(errorString,true);
            errorStrings.push(errorString);
            errorCount++;
        }
    }
}

function logWarning(str, lineNumber,urgent) {
    if (compiling||urgent) {
        if (lineNumber === undefined) {
            return logErrorNoLine(str);
        }
        var errorString = '<a onclick="jumpToLine(' + lineNumber.toString() + ');"  href="javascript:void(0);"><span class="errorTextLineNumber"> line ' + lineNumber.toString() + '</span></a> : ' + '<span class="warningText">' + str + '</span>';
         if (errorStrings.indexOf(errorString) >= 0 && !urgent) {
            //do nothing, duplicate error
         } else {
            consolePrint(errorString,true);
            errorStrings.push(errorString);
        }
    }
}
function logErrorNoLine(str,urgent) {
    if (compiling||urgent) {
        var errorString = '<span class="errorText">' + str + '</span>';
         if (errorStrings.indexOf(errorString) >= 0 && !urgent) {
            //do nothing, duplicate error
         } else {
            consolePrint(errorString,true);
            errorStrings.push(errorString);
        }
        errorCount++;
    }
}



function logBetaMessage(str,urgent){
    if (compiling||urgent) {
        var errorString = '<span class="betaText">' + str + '</span>';
         if (errorStrings.indexOf(errorString) >= 0 && !urgent) {
            //do nothing, duplicate error
         } else {
            consoleError(errorString);
            errorStrings.push(errorString);
        }
    }  
}

function blankLineHandle(state) {
    if (state.section === 'levels') {
            if (state.levels[state.levels.length - 1].length > 0)
            {
                state.levels.push([]);
            }
    } else if (state.section === 'objects') {
        state.objects_section = 0;
    }
}

//for IE support
if (typeof Object.assign != 'function') {
  (function () {
    Object.assign = function (target) {
      'use strict';
      // We must check against these specific cases.
      if (target === undefined || target === null) {
        throw new TypeError('Cannot convert undefined or null to object');
      }
 
      var output = Object(target);
      for (var index = 1; index < arguments.length; index++) {
        var source = arguments[index];
        if (source !== undefined && source !== null) {
          for (var nextKey in source) {
            if (source.hasOwnProperty(nextKey)) {
              output[nextKey] = source[nextKey];
            }
          }
        }
      }
      return output;
    };
  })();
}

var codeMirrorFn = function() {
    'use strict';


    function searchStringInArray(str, strArray) {
        for (var j = 0; j < strArray.length; j++) {
            if (strArray[j] === str) { return j; }
        }
        return -1;
    }

    function isMatrixLine(str) {
        for (var j = 0; j < str.length; j++) {
            if (str.charAt(j) !== '.' && str.charAt(j) !== '0') {
                return false;
            }
        }
        return true;
    }

    function checkNameNew(state,candname) {
        if (state.objects[candname] !== undefined) {
            logError('Object "' + candname.toUpperCase() + '" defined multiple times.', state.lineNumber);
            return 'ERROR';
        }
        for (var i=0;i<state.legend_synonyms.length;i++) {
            var entry = state.legend_synonyms[i];
            if (entry[0]==candname) {
                logError('Name "' + candname.toUpperCase() + '" already in use.', state.lineNumber);                                        
            }
        }
        for (var i=0;i<state.legend_aggregates.length;i++) {
            var entry = state.legend_aggregates[i];
            if (entry[0]==candname) {
                logError('Name "' + candname.toUpperCase() + '" already in use.', state.lineNumber);                                        
            }
        }
        for (var i=0;i<state.legend_properties.length;i++) {
            var entry = state.legend_properties[i];
            if (entry[0]==candname) {
                logError('Name "' + candname.toUpperCase() + '" already in use.', state.lineNumber);                                        
            }
        }
    }
    var absolutedirs = ['up', 'down', 'right', 'left'];
    var relativedirs = ['^', 'v', '<', '>', 'moving','stationary','parallel','perpendicular', 'no'];
    var logicWords = ['all', 'no', 'on', 'some'];
    var sectionNames = ['objects', 'legend', 'sounds', 'collisionlayers', 'rules', 'winconditions', 'levels', 'tests'];
	var commandwords = /|(?:sfx[A-Za-z0-9_-]+)|cancel|checkpoint|restart|win|message|again|count/;
    var reg_name = /[\w]+\s*/;///\w*[a-uw-zA-UW-Z0-9_]/;
    var reg_number = /[\d]+/;
    var reg_soundseed = /\d+\b/;
    var reg_spriterow = /[\.0-9]{5}\s*/;
    var reg_sectionNames = /(objects|collisionlayers|legend|sounds|rules|winconditions|levels|tests)(?![\w])\s*/;
    var reg_equalsrow = /[\=]+/;
    var reg_notcommentstart = /[^\(]+/;
    var reg_csv_separators = /[ \,]*/;
    var reg_soundverbs = /(move|action|create|destroy|cantmove|undo|restart|titlescreen|startgame|cancel|endgame|startlevel|endlevel|showmessage|closemessage|(?:sfx[A-Za-z0-9_-]+))\s+/;
    var reg_directions = /^(action|up|down|left|right|\^|v|\<|\>|moving|stationary|parallel|perpendicular|horizontal|orthogonal|vertical|no|randomdir|random)$/;
    var reg_loopmarker = /^(startloop|endloop)$/;
    var reg_ruledirectionindicators = /^(up|down|left|right|horizontal|vertical|orthogonal|late|rigid)$/;
    var reg_sounddirectionindicators = /\s*(up|down|left|right|horizontal|vertical|orthogonal)\s*/;
    var reg_winconditionquantifiers = /^(all|any|no|some)$/;
    var reg_keywords = /(checkpoint|objects|collisionlayers|legend|sounds|rules|winconditions|\.\.\.|levels|tests|up|down|left|right|^|\||\[|\]|v|\>|\<|no|horizontal|orthogonal|vertical|any|all|no|some|moving|stationary|parallel|perpendicular|action|test|given|when|then|expect|id)/;
    var keyword_array = ['checkpoint','objects', 'collisionlayers', 'legend', 'sounds', 'rules', '...','winconditions', 'levels', 'tests','|','[',']','up', 'down', 'left', 'right', 'late','rigid', '^','v','\>','\<','no','randomdir','random', 'horizontal', 'vertical','any', 'all', 'no', 'some', 'moving','stationary','parallel','perpendicular','action','message','test','given','when','then','expect','id'];
    var reg_test_inputs = /^(action|up|down|left|right|\^|v|\<|\>|tick|\.)$/;
    var test_inputs = {up: 0, left: 1, down: 2, right: 3, '^': 0, '<': 1, 'v': 2, '>': 3, action: 4, tick: 'tick', '.': 'tick'};

    //  var keywordRegex = new RegExp("\\b(("+cons.join(")|(")+"))$", 'i');

    var fullSpriteMatrix = [
        '00000',
        '00000',
        '00000',
        '00000',
        '00000'
    ];

    function parseRuleContent(state, stream, ch, sol) {
        if (state.tokenIndex===-4) {
            stream.skipToEnd();
            return 'MESSAGE';
        }
        if (stream.match(/\s*\-\>\s*/, true)) {
            return 'ARROW';
        }
        if (ch === '[' || ch === '|' || ch === ']' || ch==='+') {
            if (ch!=='+') {
                state.tokenIndex = 1;
            }
            stream.next();
            stream.match(/\s*/, true);
            return 'BRACKET';
        } else {
            var m = stream.match(/[^\[\|\]\s]*/, true)[0].trim();

            if (state.tokenIndex===0&&reg_loopmarker.exec(m)) {
                return 'BRACKET';
            } else if (state.tokenIndex === 0 && reg_ruledirectionindicators.exec(m)) {
                stream.match(/\s*/, true);
                return 'DIRECTION';
            } else if (state.tokenIndex === 1 && reg_directions.exec(m)) {
                stream.match(/\s*/, true);
                return 'DIRECTION';
            } else {
                if (state.names.indexOf(m) >= 0) {
                    if (sol) {
                        logError('Identifiers cannot appear outside of square brackets in rules, only directions can.', state.lineNumber);
                        return 'ERROR';
                    } else {
                        stream.match(/\s*/, true);
                        return 'NAME';
                    }
                } else if (m==='...') {
                    return 'DIRECTION';
                } else if (m==='rigid') {
                    return 'DIRECTION';
                } else if (m==='random') {
                    return 'DIRECTION';
                } else if (commandwords.exec(m)) {
                    if (m==='message') {
                        state.tokenIndex=-4;
                    }
                    return 'COMMAND';
                } else {
                    logError('Name "' + m + '", referred to in a rule, does not exist.', state.lineNumber);
                    return 'ERROR';
                }
            }
        }
    }

    return {
        copyState: function(state) {
            var objectsCopy = {};
            for (var i in state.objects) {
              if (state.objects.hasOwnProperty(i)) {
                var o = state.objects[i];
                objectsCopy[i] = {
                  colors: o.colors.concat([]),
                  lineNumber : o.lineNumber,
                  spritematrix: o.spritematrix.concat([])
                }
              }
            }

            var collisionLayersCopy = [];
            for (var i = 0; i < state.collisionLayers.length; i++) {
              collisionLayersCopy.push(state.collisionLayers[i].concat([]));
            }

            var legend_synonymsCopy = [];
            var legend_aggregatesCopy = [];
            var legend_propertiesCopy = [];
            var soundsCopy = [];
            var levelsCopy = [];
            var winConditionsCopy = [];
            var testsCopy = [];

            for (var i = 0; i < state.legend_synonyms.length; i++) {
              legend_synonymsCopy.push(state.legend_synonyms[i].concat([]));
            }
            for (var i = 0; i < state.legend_aggregates.length; i++) {
              legend_aggregatesCopy.push(state.legend_aggregates[i].concat([]));
            }
            for (var i = 0; i < state.legend_properties.length; i++) {
              legend_propertiesCopy.push(state.legend_properties[i].concat([]));
            }
            for (var i = 0; i < state.sounds.length; i++) {
              soundsCopy.push(state.sounds[i].concat([]));
            }
            for (var i = 0; i < state.levels.length; i++) {
              levelsCopy.push(state.levels[i].concat([]));
            }
            for (var i = 0; i < state.winconditions.length; i++) {
              winConditionsCopy.push(state.winconditions[i].concat([]));
            }
            for (var i = 0; i < state.tests.length; i++) {
              testsCopy.push(deepClone(state.tests[i]));
            }

            var original_case_namesCopy = Object.assign({},state.original_case_names);
            
            var nstate = {
              lineNumber: state.lineNumber,

              objects: objectsCopy,
              collisionLayers: collisionLayersCopy,

              commentLevel: state.commentLevel,
              section: state.section,
              visitedSections: state.visitedSections.concat([]),

              objects_candname: state.objects_candname,
              objects_section: state.objects_section,
              objects_spritematrix: state.objects_spritematrix.concat([]),

              tokenIndex: state.tokenIndex,
              legend_synonyms: legend_synonymsCopy,
              legend_aggregates: legend_aggregatesCopy,
              legend_properties: legend_propertiesCopy,

              sounds: soundsCopy,

              rules: state.rules.concat([]),

              names: state.names.concat([]),

              winconditions: winConditionsCopy,

              original_case_names : original_case_namesCopy,

              abbrevNames: state.abbrevNames.concat([]),

              metadata : state.metadata.concat([]),

              levels: levelsCopy,

              tests: testsCopy,

              levelIds: state.levelIds.concat([]),

              fragments: state.fragments.concat([]),

              STRIDE_OBJ : state.STRIDE_OBJ,
              STRIDE_MOV : state.STRIDE_MOV
            };

            return nstate;        
        },
        blankLine: function(state) {
            if (state.section === 'levels') {
                    if (state.levels[state.levels.length - 1].length > 0)
                    {
                        state.levels.push([]);
                    }
            }
        },
        token: function(stream, state) {
           	var mixedCase = stream.string;
            var sol = stream.sol();
            if (sol) {
                stream.string = stream.string.toLowerCase();
                state.tokenIndex=0;
                /*   if (state.lineNumber==undefined) {
                        state.lineNumber=1;
                }
                else {
                    state.lineNumber++;
                }*/

            }

            function registerOriginalCaseName(candname){

                function escapeRegExp(str) {
                  return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
                }

                var nameFinder =  new RegExp("\\b"+escapeRegExp(candname)+"\\b","i")
                var match = mixedCase.match(nameFinder);
                if (match!=null){
                    state.original_case_names[candname] = match[0];
                }
            }

            stream.eatWhile(/[ \t]/);

            ////////////////////////////////
            // COMMENT PROCESSING BEGIN
            ////////////////////////////////

            //NESTED COMMENTS
            var ch = stream.peek();
            if (ch === '(' && state.tokenIndex !== -4) { // tokenIndex -4 indicates message command
                stream.next();
                state.commentLevel++;
            } else if (ch === ')') {
                stream.next();
                if (state.commentLevel > 0) {
                    state.commentLevel--;
                    if (state.commentLevel === 0) {
                        return 'comment';
                    }
                }
            }
            if (state.commentLevel > 0) {
                while (true) {
                    stream.eatWhile(/[^\(\)]+/);

                    if (stream.eol()) {
                        break;
                    }

                    ch = stream.peek();

                    if (ch === '(') {
                        state.commentLevel++;
                    } else if (ch === ')') {
                        state.commentLevel--;
                    }
                    stream.next();

                    if (state.commentLevel === 0) {
                        break;
                    }
                }
                return 'comment';
            }

            stream.eatWhile(/[ \t]/);

            if (sol && stream.eol()) {
                return blankLineHandle(state);
            }

            //  if (sol)
            {

                //MATCH '==="s AT START OF LINE
                if (sol && stream.match(reg_equalsrow, true)) {
                    return 'EQUALSBIT';
                }

                //MATCH SECTION NAME
                if (stream.match(reg_sectionNames, true)) {
                    state.section = stream.string.slice(0, stream.pos).trim();
                    if (state.visitedSections.indexOf(state.section) >= 0) {
                        logError('cannot duplicate sections (you tried to duplicate \"' + state.section.toUpperCase() + '").', state.lineNumber);
                    }
                    state.visitedSections.push(state.section);
                    var sectionIndex = sectionNames.indexOf(state.section);
                    if (sectionIndex == 0) {
                        state.objects_section = 0;
                        if (state.visitedSections.length > 1) {
                            logError('section "' + state.section.toUpperCase() + '" must be the first section', state.lineNumber);
                        }
                    } else if (state.visitedSections.indexOf(sectionNames[sectionIndex - 1]) == -1) {
                        if (sectionIndex===-1) {
                            logError('no such section as "' + state.section.toUpperCase() + '".', state.lineNumber);
                        } else {
                            logError('section "' + state.section.toUpperCase() + '" is out of order, must follow  "' + sectionNames[sectionIndex - 1].toUpperCase() + '".', state.lineNumber);                            
                        }
                    }

                    if (state.section === 'sounds') {
                        //populate names from rules
                        for (var n in state.objects) {
                            if (state.objects.hasOwnProperty(n)) {
/*                                if (state.names.indexOf(n)!==-1) {
                                    logError('Object "'+n+'" has been declared to be multiple different things',state.objects[n].lineNumber);
                                }*/
                                state.names.push(n);
                            }
                        }
                        //populate names from legends
                        for (var i = 0; i < state.legend_synonyms.length; i++) {
                            var n = state.legend_synonyms[i][0];
                            /*
                            if (state.names.indexOf(n)!==-1) {
                                logError('Object "'+n+'" has been declared to be multiple different things',state.legend_synonyms[i].lineNumber);
                            }
                            */
                            state.names.push(n);
                        }
                        for (var i = 0; i < state.legend_aggregates.length; i++) {
                            var n = state.legend_aggregates[i][0];
                            /*
                            if (state.names.indexOf(n)!==-1) {
                                logError('Object "'+n+'" has been declared to be multiple different things',state.legend_aggregates[i].lineNumber);
                            }
                            */
                            state.names.push(n);
                        }
                        for (var i = 0; i < state.legend_properties.length; i++) {
                            var n = state.legend_properties[i][0];
                            /*
                            if (state.names.indexOf(n)!==-1) {
                                logError('Object "'+n+'" has been declared to be multiple different things',state.legend_properties[i].lineNumber);
                            }                           
                            */ 
                            state.names.push(n);
                        }
                    }
                    else if (state.section === 'levels') {
                        //populate character abbreviations
                        for (var n in state.objects) {
                            if (state.objects.hasOwnProperty(n) && n.length == 1) {
                                state.abbrevNames.push(n);
                            }
                        }

                        for (var i = 0; i < state.legend_synonyms.length; i++) {
                            if (state.legend_synonyms[i][0].length == 1) {
                                state.abbrevNames.push(state.legend_synonyms[i][0]);
                            }
                        }
                        for (var i = 0; i < state.legend_aggregates.length; i++) {
                            if (state.legend_aggregates[i][0].length == 1) {
                                state.abbrevNames.push(state.legend_aggregates[i][0]);
                            }
                        }
                    }
                    return 'HEADER';
                } else {
                    if (state.section === undefined) {
                        logError('must start with section "OBJECTS"', state.lineNumber);
                    }
                }

                if (stream.eol()) {
                    return null;
                }

                //if color is set, try to set matrix
                //if can't set matrix, try to parse name
                //if color is not set, try to parse color
                switch (state.section) {
                case 'objects':
                    {
						var tryParseName = function() {
                            //LOOK FOR NAME
                            var match_name = sol ? stream.match(reg_name, true) : stream.match(/[^\s\()]+\s*/,true);
                            if (match_name == null) {
                                stream.match(reg_notcommentstart, true);
                                if (stream.pos>0){                                
                                    logWarning('Unknown junk in object section (possibly: sprites have to be 5 pixels wide and 5 pixels high exactly. Or maybe: the main names for objects have to be words containing only the letters a-z0.9 - if you want to call them something like ",", do it in the legend section).',state.lineNumber);
                                }
                                return 'ERROR';
                            } else {
                            	var candname = match_name[0].trim();
                                if (state.objects[candname] !== undefined) {
                                    logError('Object "' + candname.toUpperCase() + '" defined multiple times.', state.lineNumber);
                                    return 'ERROR';
                                }
                                for (var i=0;i<state.legend_synonyms.length;i++) {
                                	var entry = state.legend_synonyms[i];
                                	if (entry[0]==candname) {
                                    	logError('Name "' + candname.toUpperCase() + '" already in use.', state.lineNumber);                                		
                                	}
                                }
                                if (keyword_array.indexOf(candname)>=0) {
                                    logWarning('You named an object "' + candname.toUpperCase() + '", but this is a keyword. Don\'t do that!', state.lineNumber);
                                }

                                if (sol) {
                                	state.objects_candname = candname;
                                    registerOriginalCaseName(candname);
                                	state.objects[state.objects_candname] = {
										                                	lineNumber: state.lineNumber,
										                                	colors: [],
										                                	spritematrix: []
										                                };

								} else {
									//set up alias
                                    registerOriginalCaseName(candname);
									var synonym = [candname,state.objects_candname];
									synonym.lineNumber = state.lineNumber;
									state.legend_synonyms.push(synonym);
								}
                                state.objects_section = 1;
                                return 'NAME';
                            }
                        };

                        if (sol && state.objects_section == 2) {
                            state.objects_section = 3;
                        }

                        if (sol && state.objects_section == 1) {
                            state.objects_section = 2;
                        }

                        switch (state.objects_section) {
                        case 0:
                        case 1:
                            {
                                state.objects_spritematrix = [];
                                return tryParseName();
                                break;
                            }
                        case 2:
                            {
                                //LOOK FOR COLOR
                                state.tokenIndex = 0;

                                var match_color = stream.match(reg_color, true);
                                if (match_color == null) {
                                    var str = stream.match(reg_name, true) || stream.match(reg_notcommentstart, true);
                                    logError('Was looking for color for object ' + state.objects_candname.toUpperCase() + ', got "' + str + '" instead.', state.lineNumber);
                                    return null;
                                } else {
                                    if (state.objects[state.objects_candname].colors === undefined) {
                                        state.objects[state.objects_candname].colors = [match_color[0].trim()];
                                    } else {
                                        state.objects[state.objects_candname].colors.push(match_color[0].trim());
                                    }

                                    var candcol = match_color[0].trim().toLowerCase();
                                    if (candcol in colorPalettes.arnecolors) {
                                        return 'COLOR COLOR-' + candcol.toUpperCase();
                                    } else if (candcol==="transparent") {
                                        return 'COLOR FADECOLOR';
                                    } else {
                                        return 'MULTICOLOR'+match_color[0];
                                    }
                                }
                                break;
                            }
                        case 3:
                            {
                                var ch = stream.eat(/[.\d]/);
                                var spritematrix = state.objects_spritematrix;
                                if (ch === undefined) {
                                    if (spritematrix.length === 0) {
                                        return tryParseName();
                                    }
                                    logError('Unknown junk in spritematrix for object ' + state.objects_candname.toUpperCase() + '.', state.lineNumber);
                                    stream.match(reg_notcommentstart, true);
                                    return null;
                                }

                                if (sol) {
                                    spritematrix.push('');
                                }

                                var o = state.objects[state.objects_candname];

                                spritematrix[spritematrix.length - 1] += ch;
                                if (spritematrix[spritematrix.length-1].length>5){
                                    logError('Sprites must be 5 wide and 5 high.', state.lineNumber);
                                    stream.match(reg_notcommentstart, true);
                                    return null;
                                }
                                o.spritematrix = state.objects_spritematrix;
                                if (spritematrix.length === 5 && spritematrix[spritematrix.length - 1].length == 5) {
                                    state.objects_section = 0;
                                }

                                if (ch!=='.') {
                                    var n = parseInt(ch);
                                    if (n>=o.colors.length) {
                                        logError("Trying to access color number "+n+" from the color palette of sprite " +state.objects_candname.toUpperCase()+", but there are only "+o.colors.length+" defined in it.",state.lineNumber);
                                        return 'ERROR';
                                    }
                                    if (isNaN(n)) {
                                        logError('Invalid character "' + ch + '" in sprite for ' + state.objects_candname.toUpperCase(), state.lineNumber);
                                        return 'ERROR';
                                    }
                                    return 'COLOR BOLDCOLOR COLOR-' + o.colors[n].toUpperCase();
                                }
                                return 'COLOR FADECOLOR';
                            }
                        default:
                        	{
                        	window.console.logError("EEK shouldn't get here.");
                        	}
                        }
                        break;
                    }
                case 'sounds':
                    {
                        if (sol) {
                            var ok = true;
                            var splits = reg_notcommentstart.exec(stream.string)[0].split(/\s/).filter(function(v) {return v !== ''});                          
                            splits.push(state.lineNumber);
                            state.sounds.push(splits);
                        }
                        candname = stream.match(reg_soundverbs, true);
                        if (candname!==null) {
                        	return 'SOUNDVERB';
                        }
                        candname = stream.match(reg_sounddirectionindicators,true);
                        if (candname!==null) {
                        	return 'DIRECTION';
                        }
                        candname = stream.match(reg_soundseed, true);
                        if (candname !== null)
                        {
                            state.tokenIndex++;
                            return 'SOUND';
                        } 
                       	candname = stream.match(/[^\[\|\]\s]*/, true);
                       	if (candname!== null ) {
                       		var m = candname[0].trim();
                       		if (state.names.indexOf(m)>=0) {
                       			return 'NAME';
                       		}
                       	}

                        candname = stream.match(reg_notcommentstart, true);
                        logError('unexpected sound token "'+candname+'".' , state.lineNumber);
                        stream.match(reg_notcommentstart, true);
                        return 'ERROR';
                        break;
                    }
                case 'collisionlayers':
                    {
                        if (sol) {
                            //create new collision layer
                            state.collisionLayers.push([]);
                            state.tokenIndex=0;
                        }

                        var match_name = stream.match(reg_name, true);
                        if (match_name === null) {
                            //then strip spaces and commas
                            var prepos=stream.pos;
                            stream.match(reg_csv_separators, true);
                            if (stream.pos==prepos) {
                                logError("error detected - unexpected character " + stream.peek(),state.lineNumber);
                                stream.next();
                            }
                            return null;
                        } else {
                            //have a name: let's see if it's valid
                            var candname = match_name[0].trim();

                            var substitutor = function(n) {
                            	n = n.toLowerCase();
                            	if (n in state.objects) {
                            		return [n];
                            	} 


                                for (var i=0;i<state.legend_synonyms.length;i++) {
                                    var a = state.legend_synonyms[i];
                                    if (a[0]===n) {           
                                        return substitutor(a[1]);
                                    }
                                }

                            	for (var i=0;i<state.legend_aggregates.length;i++) {
                            		var a = state.legend_aggregates[i];
                            		if (a[0]===n) {           
                            			logError('"'+n+'" is an aggregate (defined using "and"), and cannot be added to a single layer because its constituent objects must be able to coexist.', state.lineNumber);
                            			return [];         
                            		}
                            	}
                            	for (var i=0;i<state.legend_properties.length;i++) {
                            		var a = state.legend_properties[i];
                            		if (a[0]===n) {  
                                        var result = [].concat.apply([],a.slice(1).map(substitutor));
                            			return result;
                            		}
                            	}
                            	logError('Cannot add "' + candname.toUpperCase() + '" to a collision layer; it has not been declared.', state.lineNumber);                                
                            	return [];
                            };
                            if (candname==='background' ) {
                                if (state.collisionLayers.length>0&&state.collisionLayers[state.collisionLayers.length-1].length>0) {
                                    logError("Background must be in a layer by itself.",state.lineNumber);
                                }
                                state.tokenIndex=1;
                            } else if (state.tokenIndex!==0) {
                                logError("Background must be in a layer by itself.",state.lineNumber);
                            }

                            var ar = substitutor(candname);

                            if (state.collisionLayers.length===0) {
                                logError("no layers found.",state.lineNumber);
                                return 'ERROR';
                            }
                            
                            var foundOthers=[];
                            for (var i=0;i<ar.length;i++){
                                var candname = ar[i];
                                for (var j=0;j<=state.collisionLayers.length-1;j++){
                                    var clj = state.collisionLayers[j];
                                    if (clj.indexOf(candname)>=0){
                                        if (j!=state.collisionLayers.length-1){
                                            foundOthers.push(j);
                                        }
                                    }
                                }
                            }
                            if (foundOthers.length>0){
                                var warningStr = 'Object "'+candname.toUpperCase()+'" included in multiple collision layers ( layers ';
                                for (var i=0;i<foundOthers.length;i++){
                                    warningStr+=foundOthers[i]+", ";
                                }
                                warningStr+=state.collisionLayers.length-1;
                                logWarning(warningStr +'). You should fix this!',state.lineNumber);                                        
                            }

                            state.collisionLayers[state.collisionLayers.length - 1] = state.collisionLayers[state.collisionLayers.length - 1].concat(ar);
                            if (ar.length>0) {
                            	return 'NAME';                            
                            } else {
                            	return 'ERROR';
                            }
                        }
                        break;
                    }
                case 'legend':
                    {
                        if (sol) {


                            //step 1 : verify format
                            var longer = stream.string.replace('=', ' = ');
                            longer = reg_notcommentstart.exec(longer)[0];

                            var splits = longer.split(/\s/).filter(function(v) {
                                return v !== '';
                            });
                            var ok = true;

                        	if (splits.length>0) {
                        		var candname = splits[0].toLowerCase();
	                            if (keyword_array.indexOf(candname)>=0) {
	                                logWarning('You named an object "' + candname.toUpperCase() + '", but this is a keyword. Don\'t do that!', state.lineNumber);
	                            }
                                if (splits.indexOf(candname, 2)>=2) {
                                    logError("You can't define object " + candname.toUpperCase() + " in terms of itself!", state.lineNumber);
                                    ok = false;
                                }
                                checkNameNew(state,candname);
                        	}

                            if (!ok) {
                            } else if (splits.length < 3) {
                                ok = false;
                            } else if (splits[1] !== '=') {
                                ok = false;
                            } /*else if (splits[0].charAt(splits[0].length - 1) == 'v') {
                                logError('names cannot end with the letter "v", because it\'s is used as a direction.', state.lineNumber);
                                stream.match(reg_notcommentstart, true);
                                return 'ERROR';
                            } */ else if (splits.length === 3) {
                                var synonym = [splits[0], splits[2].toLowerCase()];
                                synonym.lineNumber = state.lineNumber;

                                registerOriginalCaseName(splits[0]);
                                state.legend_synonyms.push(synonym);
                            } else if (splits.length % 2 === 0) {
                                ok = false;
                            } else {
                                var lowertoken = splits[3].toLowerCase();
                                if (lowertoken === 'and') {

	                                var substitutor = function(n) {
	                                	n = n.toLowerCase();
	                                	if (n in state.objects) {
	                                		return [n];
	                                	} 
	                                	for (var i=0;i<state.legend_synonyms.length;i++) {
	                                		var a = state.legend_synonyms[i];
	                                		if (a[0]===n) {   
	                                			return substitutor(a[1]);
	                                		}
	                                	}
	                                	for (var i=0;i<state.legend_aggregates.length;i++) {
	                                		var a = state.legend_aggregates[i];
	                                		if (a[0]===n) {                                			
	                                			return [].concat.apply([],a.slice(1).map(substitutor));
	                                		}
	                                	}
	                                	for (var i=0;i<state.legend_properties.length;i++) {
	                                		var a = state.legend_properties[i];
	                                		if (a[0]===n) {         
	                                			logError("Cannot define an aggregate (using 'and') in terms of properties (something that uses 'or').", state.lineNumber);
	                                			ok=false;
	                                			return [n];
	                                		}
	                                	}
	                                	return [n];
	                                };

                                    for (var i = 5; i < splits.length; i += 2) {
                                        if (splits[i].toLowerCase() !== 'and') {
                                            ok = false;
                                            break;
                                        }
                                    }
                                    if (ok) {
                                        var newlegend = [splits[0]].concat(substitutor(splits[2])).concat(substitutor(splits[4]));
                                        for (var i = 6; i < splits.length; i += 2) {
                                            newlegend = newlegend.concat(substitutor(splits[i]));
                                        }
                                        newlegend.lineNumber = state.lineNumber;

                                        registerOriginalCaseName(newlegend[0]);
                                        state.legend_aggregates.push(newlegend);
                                    }
                                } else if (lowertoken === 'or') {

	                                var substitutor = function(n) {
	                                	n = n.toLowerCase();
	                                	if (n in state.objects) {
	                                		return [n];
	                                	} 

	                                	for (var i=0;i<state.legend_synonyms.length;i++) {
	                                		var a = state.legend_synonyms[i];
	                                		if (a[0]===n) {   
	                                			return substitutor(a[1]);
	                                		}
	                                	}
	                                	for (var i=0;i<state.legend_aggregates.length;i++) {
	                                		var a = state.legend_aggregates[i];
	                                		if (a[0]===n) {           
	                                			logError("Cannot define a property (using 'or') in terms of aggregates (something that uses 'and').", state.lineNumber);
	                                			ok=false;          
	                                		}
	                                	}
	                                	for (var i=0;i<state.legend_properties.length;i++) {
	                                		var a = state.legend_properties[i];
	                                		if (a[0]===n) {  
	                                			return [].concat.apply([],a.slice(1).map(substitutor));
	                                		}
	                                	}
	                                	return [n];
	                                };

                                    for (var i = 5; i < splits.length; i += 2) {
                                        if (splits[i].toLowerCase() !== 'or') {
                                            ok = false;
                                            break;
                                        }
                                    }
                                    if (ok) {
                                        var newlegend = [splits[0]].concat(substitutor(splits[2])).concat(substitutor(splits[4]));
                                        for (var i = 6; i < splits.length; i += 2) {
                                            newlegend.push(splits[i].toLowerCase());
                                        }
                                        newlegend.lineNumber = state.lineNumber;

                                        registerOriginalCaseName(newlegend[0]);
                                        state.legend_properties.push(newlegend);
                                    }
                                } else {
                                    ok = false;
                                }
                            }

                            if (ok === false) {
                                logError('incorrect format of legend - should be one of A = B, A = B or C ( or D ...), A = B and C (and D ...)', state.lineNumber);
                                stream.match(reg_notcommentstart, true);
                                return 'ERROR';
                            }

                            state.tokenIndex = 0;
                        }

                        if (state.tokenIndex === 0) {
                            stream.match(/[^=]*/, true);
                            state.tokenIndex++;
                            return 'NAME';
                        } else if (state.tokenIndex === 1) {
                            stream.next();
                            stream.match(/\s*/, true);
                            state.tokenIndex++;
                            return 'ASSSIGNMENT';
                        } else {
                            var match_name = stream.match(reg_name, true);
                            if (match_name === null) {
                                logError("Something bad's happening in the LEGEND", state.lineNumber);
                                stream.match(reg_notcommentstart, true);
                                return 'ERROR';
                            } else {
                                var candname = match_name[0].trim();

                                if (state.tokenIndex % 2 === 0) {

	                                var wordExists = function(n) {
	                                	n = n.toLowerCase();
	                                	if (n in state.objects) {
	                                		return true;
	                                	} 
	                                	for (var i=0;i<state.legend_aggregates.length;i++) {
	                                		var a = state.legend_aggregates[i];
	                                		if (a[0]===n) {                                			
	                                			return true;
	                                		}
	                                	}
	                                	for (var i=0;i<state.legend_properties.length;i++) {
	                                		var a = state.legend_properties[i];
	                                		if (a[0]===n) {  
	                                			return true;
	                                		}
	                                	}
	                                	for (var i=0;i<state.legend_synonyms.length;i++) {
	                                		var a = state.legend_synonyms[i];
	                                		if (a[0]===n) {  
	                                			return true;
	                                		}
	                                	}
	                                	return false;
	                                };


                                    if (wordExists(candname)===false) {
                                            logError('Cannot reference "' + candname.toUpperCase() + '" in the LEGEND section; it has not been defined yet.', state.lineNumber);
                                            state.tokenIndex++;
                                            return 'ERROR';
                                    } else {
                                            state.tokenIndex++;
                                            return 'NAME';
                                    }
                                } else {
                                        state.tokenIndex++;
                                        return 'LOGICWORD';
                                }
                            }
                        }
                        break;
                    }
                case 'rules':
                    {                    	
                        if (sol) {
                            var rule = reg_notcommentstart.exec(stream.string)[0];
                            state.rules.push([rule, state.lineNumber, mixedCase]);
                            state.tokenIndex = 0;//in rules, records whether bracket has been found or not
                        }

                        return parseRuleContent(state, stream, ch, sol);
                    }
                case 'winconditions':
                    {
                        if (sol) {
                        	var tokenized = reg_notcommentstart.exec(stream.string);
                        	var splitted = tokenized[0].split(/\s/);
                        	var filtered = splitted.filter(function(v) {return v !== ''});
                            filtered.push(state.lineNumber);
                            
                            state.winconditions.push(filtered);
                            state.tokenIndex = -1;
                        }
                        state.tokenIndex++;
                        var match = stream.match(/\s*\w+\s*/);
                        if (match === null) {
                                logError('incorrect format of win condition.', state.lineNumber);
                                stream.match(reg_notcommentstart, true);
                                return 'ERROR';

                        } else {
                            var candword = match[0].trim();
                            if (state.tokenIndex === 0) {
                                if (reg_winconditionquantifiers.exec(candword)) {
                                    return 'LOGICWORD';
                                }
                                else {
                                    return 'ERROR';
                                }
                            }
                            else if (state.tokenIndex === 2) {
                                if (candword != 'on') {
                                    return 'ERROR';
                                } else {
                                    return 'LOGICWORD';
                                }
                            }
                            else if (state.tokenIndex === 1 || state.tokenIndex === 3) {
                                if (state.names.indexOf(candword)===-1) {
                                    logError('Error in win condition: "' + candword.toUpperCase() + '" is not a valid object name.', state.lineNumber);
                                    return 'ERROR';
                                } else {
                                    return 'NAME';
                                }
                            }
                        }
                        break;
                    }
                case 'levels':
                    {
                        if (sol)
                        {
                            if (stream.match(/\s*message\s*/, true)) {
                                state.tokenIndex = 1;//1/2 = message/level
                                var newdat = ['\n', mixedCase.slice(stream.pos).trim(),state.lineNumber];
                                if (state.levels[state.levels.length - 1].length == 0) {
                                    state.levels.splice(state.levels.length - 1, 0, newdat);
                                } else {
                                    state.levels.push(newdat);
                                }
                                if (state.levels.length > state.levelIds.length) {
                                    // Ensure the number of IDs equals the number of levels, so the indices match even if we don't have all IDs
                                    state.levelIds.push(null);
                                }
                                return 'MESSAGE_VERB';
                            } else if (stream.match(/\s*id\s*/, true)) {
                                state.tokenName = 'LEVEL_ID';
                                var rawId = stream.string.substring(stream.pos);
                                if (rawId && rawId.trim().length) {
                                    var id = rawId.trim();
                                    state.levelIds.push(id);
                                } else {
                                    logWarning('Expected to see a level ID. Did you mean to add one?', state.lineNumber);
                                }
                                return 'LEVEL_ID_VERB';
                            } else {
                                state.tokenName = 'LEVEL';
                                var line = stream.match(reg_notcommentstart, false)[0].trim();
                                state.tokenIndex = 2;
                                var lastlevel = state.levels[state.levels.length - 1];
                                if (lastlevel[0] == '\n') {
                                    state.levels.push([state.lineNumber,line]);
                                } else {
                                    if (lastlevel.length==0)
                                    {
                                        lastlevel.push(state.lineNumber);
                                    }
                                    lastlevel.push(line);

                                    if (lastlevel.length>1) 
                                    {
                                        if (line.length!=lastlevel[1].length) {
                                            logWarning("Maps must be rectangular, yo (In a level, the length of each row must be the same).",state.lineNumber);
                                        }
                                    }
                                }
                                if (state.levels.length > state.levelIds.length) {
                                    state.levelIds.push(null);
                                }
                            }
                        } else {
                            if (state.tokenIndex == 1) {
                                stream.skipToEnd();
                               	return 'MESSAGE';
                            }

                            if (state.tokenName == 'LEVEL_ID') {
                                stream.skipToEnd();
                                return 'LEVEL_ID'
                            }
                        }

                        if (state.tokenIndex === 2 && !stream.eol()) {
                            var ch = stream.peek();
                            stream.next();
                            if (state.abbrevNames.indexOf(ch) >= 0) {
                                return 'LEVEL';
                            } else {
                                logError('Key "' + ch.toUpperCase() + '" not found. Do you need to add it to the legend, or define a new object?', state.lineNumber);
                                return 'ERROR';
                            }
                        }
                        break;
                    }
                case 'tests': {
                    var firstChar = stream.peek();
                    // Get the last test (or a blank one)
                    var test = state.tests.length ? state.tests[state.tests.length - 1] : {}

                    if (sol) {
                        if (stream.match(/\s*test\s*/, true)) {
                            // We've found a new test
                            if (state.tests.length) {
                                test = {};
                            }
                            state.tests.push(test);
                            test.name = mixedCase.slice(stream.pos).trim();
                            if (!test.name || !test.name.length) {
                                logWarning('Tests should be given names, bro. Be as descriptive as you like e.g. "test dogs chase cats but cats win in fights"', state.lineNumber);
                            }
                            state.tokenName = 'TEST_VERB';
                            return 'TEST_VERB';
                        } else if (stream.match(/\s*given\s*/)) {
                            // It's a test precondition
                            state.tokenName = 'GIVEN_VERB';
                            return 'GIVEN_VERB';
                        } else if (stream.match(/\s*when\s*/)) {
                            // It's a test step
                            state.tokenName = 'WHEN_VERB';
                            if (!test.steps) {
                                test.steps = [];
                            }
                            test.steps.push({});
                            var step = test.steps[test.steps.length - 1];
                            step.when = {inputs: []};
                            return 'WHEN_VERB';
                        } else if (stream.match(/\s*then\s*/)) {
                            // It's an expected outcome
                            state.tokenName = 'THEN_VERB';
                            return 'THEN_VERB';
                        } else if (stream.match(/\s*expect\s*/)) {
                            // It's an expected condition
                            if (!test.steps) {
                                test.steps = [{}];
                            }

                            var step = test.steps[test.steps.length - 1];
                            if (!step.then) {
                                step.then = {};
                            }
                            if (!step.then.conditions) {
                                step.then.conditions = [];
                            }
                            step.then.conditions.push({lineNumber: state.lineNumber, actualCount: 0});
                            state.tokenName = 'EXPECT_VERB';
                            return 'EXPECT_VERB';
                        } else if (state.abbrevNames.indexOf(firstChar) >= 0) {
                            // It's a level fragment
                            var line = stream.match(reg_notcommentstart, false)[0].trim();
                            state.tokenName = 'FRAGMENT';

                            var step = test.steps && test.steps[test.steps.length - 1];
                            var fragmentType = step && step.when ? 'THEN' : 'WHEN';

                            var partialFragment;
                            if (fragmentType === 'WHEN') {
                                partialFragment = test.given;
                            } else {
                                if (!step.then) {
                                    step.then = {};
                                }
                                partialFragment = step.then.fragment;
                            }

                            var fragment = partialFragment ? partialFragment : [];

                            if (!fragment.length) {
                                fragment.push(state.lineNumber);
                            }

                            fragment.push(line);

                            if (fragment.length > 1) {
                                if (line.length !== fragment[1].length) {
                                    logWarning('Level fragments must be rectangular, pal (just like normal levels).', state.lineNumber);
                                }
                            }

                            if (fragmentType === 'WHEN') {
                                test.given = fragment;
                            } else {
                                step.then.fragment = fragment;
                            }
                        }
                    } else {
                        if (state.tokenName === 'TEST_VERB' || state.tokenName === 'THEN_VERB') {
                            stream.skipToEnd();
                            return 'TEST_NAME';
                        } else if (state.tokenName === 'GIVEN_VERB') {
                            test.levelId = stream.match(/[^\s]*/, true)[0].trim();
                            if (state.levelIds.indexOf(test.levelId) === -1) {
                                logError('No level with ID "' + test.levelId + '" could be found.', state.lineNumber);
                            }
                            return 'LEVEL_ID';
                        } else if (state.tokenName === 'WHEN_VERB') {
                            var step = test.steps[test.steps.length - 1];
                            var m = stream.match(/[^\s]*/, true)[0].trim();

                            if (reg_test_inputs.exec(m)) {
                                stream.match(/\s*/, true);
                                step.when.inputs.push(test_inputs[m]);
                                return 'DIRECTION';
                            } else {
                                logError('Unrecognised stuff in the WHEN section of a test. Directions, "action" and "tick" only, please.');
                                return 'ERROR';
                            }
                        } else if (state.tokenName === 'EXPECT_VERB') {
                            var step = test.steps[test.steps.length - 1]
                            var condition = step.then.conditions[step.then.conditions.length - 1];

                            if (stream.match(/\s*win\s*/)) {
                                condition.expectWin = true;
                                return 'COMMAND';
                            }

                            var expectedCountMatch = stream.match(/\s*\d+\s*/);
                            if (expectedCountMatch) {
                                condition.expectedCount = Number(expectedCountMatch[0].trim());
                                return 'EXPECT_COUNT';
                            }

                            if (!condition.rule) {
                                // Grab the rule and add custom test RHS command
                                var restOfLine = stream.string.substring(stream.pos);
                                var rawRule = reg_notcommentstart.exec(restOfLine)[0];

                                if (rawRule.indexOf('->') > -1) {
                                    rawRule = rawRule.substring(0, rawRule.indexOf('->'));
                                    logError('Test conditions aren\'t like normal rules. They can\'t include outcomes - that means no "->". Think of them as the left-hand side of rules only.', state.lineNumber);
                                }

                                var rule = rawRule + ' -> count';
                                condition.rawRule = rawRule;
                                condition.rule = [rule, state.lineNumber, mixedCase + ' -> count'];
                                state.tokenIndex = 0; // Indicates bracket hasn't been found yet

                                if (!condition.expectedCount && condition.expectedCount !== 0) {
                                    // Default of 1 if no expected count is entered
                                    condition.expectedCount = 1;
                                }
                            }

                            return parseRuleContent(state, stream, ch, sol);
                        }
                    }

                    if ((state.tokenName === 'LEVEL' || state.tokenName === 'FRAGMENT') && !stream.eol()) {
                        stream.next();

                        if (state.abbrevNames.indexOf(ch) >= 0) {
                            return state.tokenName;
                        } else {
                            logError('Key "' + ch.toUpperCase() + '" not found. Do you need to add it to the legend, or define a new object?', state.lineNumber);
                            return 'ERROR';
                        }
                    }
                }
	                
	                default://if you're in the preamble
	                {
	            		if (sol) {
	            			state.tokenIndex=0;
	            		}
	            		if (state.tokenIndex==0) {
		                    var match = stream.match(/\s*\w+\s*/);	                    
		                    if (match!==null) {
		                    	var token = match[0].trim();
		                    	if (sol) {
		                    		if (['title','author','homepage','background_color','text_color','key_repeat_interval','realtime_interval','again_interval','flickscreen','zoomscreen','color_palette','youtube'].indexOf(token)>=0) {
		                    			
                                        if (token==='youtube' || token==='author' || token==='title') {
                                            stream.string=mixedCase;
                                        }
                                        
                                        var m2 = stream.match(reg_notcommentstart, false);
                                        
		                    			if(m2!=null) {
                                            state.metadata.push(token);
		                    				state.metadata.push(m2[0].trim());                                            
		                    			} else {
		                    				logError('MetaData "'+token+'" needs a value.',state.lineNumber);
		                    			}
		                    			state.tokenIndex=1;
		                    			return 'METADATA';
		                    		} else if ( ['run_rules_on_level_start','norepeat_action','require_player_movement','debug','verbose_logging','throttle_movement','noundo','noaction','norestart','scanline'].indexOf(token)>=0) {
		                    			state.metadata.push(token);
		                    			state.metadata.push("true");
		                    			state.tokenIndex=-1;
		                    			return 'METADATA';
		                    		} else  {
		                    			logError('Unrecognised stuff in the prelude.', state.lineNumber);
		                    			return 'ERROR';
		                    		}
		                    	} else if (state.tokenIndex==-1) {
	                   				logError('MetaData "'+token+'" has no parameters.',state.lineNumber);
		                    		return 'ERROR';
		                    	}
		                    	return 'METADATA';
		                    }       
		               	} else {
		               		stream.match(reg_notcommentstart, true);
		               		return "METADATATEXT";
		               	}
	                	break;
	                }
	            }
            };

            if (stream.eol()) {
                return null;
            }
            if (!stream.eol()) {
                stream.next();
                return null;
            }
        },
        startState: function() {
            return {
                /*
                    permanently useful
                */
                objects: {},

                /*
                    for parsing
                */
                lineNumber: 0,

                commentLevel: 0,

                section: '',
                visitedSections: [],

                objects_candname: '',
                objects_section: 0, //whether reading name/color/spritematrix
                objects_spritematrix: [],

                collisionLayers: [],

                tokenIndex: 0,

                legend_synonyms: [],
                legend_aggregates: [],
                legend_properties: [],

                sounds: [],
                rules: [],

                names: [],

                winconditions: [],
                metadata: [],

                original_case_names: {},

                abbrevNames: [],

                levels: [[]],

                tests: [],
                levelIds: [],
                fragments: [],

                subsection: ''
            };
        }
    };
};

window.CodeMirror.defineMode('puzzle', codeMirrorFn);
