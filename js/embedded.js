
String.prototype.replaceAll = function(search, replacement) {
    var target = this;
    return target.replace(new RegExp(search, 'g'), replacement);
};

function ARDU_spriteGlyphs(){
    var strb=`PROGMEM const byte tiles_b[][8] = {\n`;
    var strw=`PROGMEM const byte tiles_w[][8] = {\n`;
    for (var i = 0; i < sprites.length; i++) {
        strb+="\t{\n"
        strw+="\t{\n"
        if (sprites[i] == undefined) {
            continue;
        }

        var s = sprites[i];

        for (var j=0;j<8;j++){
            var black="";
            var white="";
            for (var k=0;k<8;k++){
                var p = s.dat[k][j]
                var c = (p==-1||p==".")?".":s.colors[ p ];                
                c = c.toLowerCase();
                if (c==="black"||c==="#000000"){
                    black="1"+black;
                } else {
                    black="0"+black;
                }
                if (c==="white"||c==="#ffffff"){
                    white="1"+white;
                } else {
                    white="0"+white;
                }
            }
            strb+="\t\t0b"+black+",\n"
            strw+="\t\t0b"+white+",\n"
        }
        strb+="\t},\n"
        strw+="\t},\n"
    }
    strb+=`};\n`
    strw+=`};\n`
    return `const int GLYPH_COUNT = ` +sprites.length+`;\n\n`+strb+'\n'+strw;
}

function ARDU_levelDat(){
	var levelDat = `const byte levels[][128] {\n`
	for (var i=0;i<state.levels.length;i++){
		var level=state.levels[i]
		levelDat+="\t{\n\t\t"
		for (var j=0;j<8;j++){
			for (var k=0;k<16;k++){
				var idx = j+8*k
				levelDat+=level.objects[idx]+","
			}
			levelDat+="\n"
			if (j<7){
				levelDat+="\t\t"
			}
		}
		levelDat+="\t},\n"
	}
	levelDat+="};\n"
	return levelDat
}

function printInt(n,bits){
    var result = n.toString(2);
    while(result.length<bits){
        result = '0'+result;;
    }
    return '0b'+result;
}

function ARDU_playerConstants(){
    var result="";

    result+= "const byte PLAYER_MASK = "+printInt(state.playerMask.data[0],8)+";\n";
    
    var playerLayers = getLayersOfMask(state.playerMask)
    var playerLayerMask = 0;
    for (var i=0;i<playerLayers.length;i++){
        var l = playerLayers.length;
        playerLayerMask+=0b11111<<(5*playerLayers[0]);
    }
    result += "const long PLAYER_LAYERMASK = "+printInt(playerLayerMask,32)+";\n";


    result+="\n";
    result += "const long LAYERMASK[] = {\n"
    for (var i=0;i<state.collisionLayers.length;i++){
        var clayer = state.collisionLayers[i];
        var lMask = 0;

        for (var n=0;n<state.objectCount;n++){
            var obN=state.idDict[n];
            if (clayer.indexOf(obN)>=0){
                lMask |= (1<<n);
            }
        }
        result+="\t"+printInt(lMask,32)+",\n";

    }
    result += "};\n";

    return result;
}

function GenerateMatchPattern(d,p){
    var movementsMissing = [];
    var movementsPresent = [];
    var objectsMissing = [];
    var objectsPresent = [];
    var tests="";
    for (var l=0;l<p.length;l++){
        var c = p[l]
        var movementMissing=c.movementsMissing.data[0];
        var movementPresent=c.movementsPresent.data[0];
        var objectMissing=c.objectsMissing.data[0];
        var objectPresent=c.objectsPresent.data[0];

        var _cellObjects = (l===0)?"level[i]":"level[i+"+l*d+"]"
        var _cellMovements = (l===0)?"movementMask[i]":"movementMask[i+"+l*d+"]"
        if (tests.length>0){
            tests+=" && ";
        }
        if (objectPresent!==0){
            tests+="("+_cellObjects+" & "+objectPresent+")";
            if (movementPresent!==0){
                tests+=" && ("+_cellMovements+" & "+movementPresent+")";                            
            }
        }
    }
    return tests;
}

function GeneratePatternReplacement(d,p){
    var movementsMissing = [];
    var movementsPresent = [];
    var objectsMissing = [];
    var objectsPresent = [];
    var test="";
    for (var l=0;l<p.length;l++){
        var c = p[l]
        var movementMissing=c.movementsMissing.data[0];
        var movementPresent=c.movementsPresent.data[0];
        var objectMissing=c.objectsMissing.data[0];
        var objectPresent=c.objectsPresent.data[0];

        var objectsClear=c.replacement.objectsClear.data[0];
        var objectsSet=c.replacement.objectsSet.data[0];
        var movementsClear=c.replacement.movementsClear.data[0];
        var movementsLayerMask=c.replacement.movementsLayerMask.data[0];
        var movementsSet=c.replacement.movementsSet.data[0];
        var objectPrandomDirMaskresent=c.replacement.randomDirMask.data[0];
        var randomEntityMask=c.replacement.randomEntityMask.data[0];


        var objectsPreserve=(~objectsClear)>>> 0;
        var movementsPresent=(~movementsClear)>>> 0;

        var lvlName = (l===0) ? "level[i]" : "level[i+"+l*d+"]"
        test += "\t\t"+lvlName + " = "
        test += `(${lvlName}&${objectsPreserve})|${objectsSet};\n`
        var mvmtName = (l===0) ? "movementMask[i]" : "movementMask[i+"+l*d+"]"
        test += "\t\t"+mvmtName + " = "
        test += `(${mvmtName}&${movementsPresent})|${movementsSet};\n`

    }
    return test;
}


function ARDU_rulesDat(){
    var result="";
    for (var i=0;i<state.rules.length;i++){
        var rg = state.rules[i];
        for (var j=0;j<rg.length;j++){
            var r = rg[j];
            var ruleDir = r.direction;
            var d = ruleDir===8?1:16;//right is 8, otherwise down
            for (var k=0;k<r.patterns.length;k++){   
                var test = GenerateMatchPattern(d,r.patterns[k])
                var replacement = GeneratePatternReplacement(d,r.patterns[k])
                var l = r.patterns[k].length;
                var maxY=8;
                var maxX=16;
                if (d===1){
                    maxX-=l-1;
                } else {
                    maxY-=l-1;                    
                }
                                result+=
`bool applyRule${i}_${j}_${k}(){ 
  for (byte y=0;y<${maxY};y++){
    for (byte x=0;x<${maxX};x++){  
      byte i = x+16*y;
      if (${test}){
${replacement}
      }
    }
  }
}
`
            }
        }
    }
    console.log(result);
    return result;
}

function exportEmbeddedClick(){


	var sourceCode = editor.getValue();

	compile("restart");
    
    var outputTxt=`
const byte DIR_UP     = 0b00001;
const byte DIR_DOWN   = 0b00010;
const byte DIR_LEFT   = 0b00100;
const byte DIR_RIGHT  = 0b01000;
const byte DIR_ACTION = 0b10000;

const word ALL_UP = DIR_UP+(DIR_UP<<5)+(DIR_UP<<10);
const word ALL_DOWN = DIR_DOWN+(DIR_DOWN<<5)+(DIR_DOWN<<10);
const word ALL_LEFT = DIR_LEFT+(DIR_LEFT<<5)+(DIR_LEFT<<10);
const word ALL_RIGHT = DIR_RIGHT+(DIR_RIGHT<<5)+(DIR_RIGHT<<10);

byte level[128];
word movementMask[128];
byte rowCellContents[8];
byte colCellContents[16];
byte mapCellContents=0;
`;

    var playerConsts = ARDU_playerConstants();
    outputTxt+=playerConsts;
    
	var glyphText = ARDU_spriteGlyphs();
	outputTxt+=glyphText+"\n";
    
    var levelText = ARDU_levelDat();
    outputTxt+=levelText+"\n";
    
    var rulesText = ARDU_rulesDat();
    outputTxt+=rulesText+"\n";

	addToConsole(outputTxt)
	console.log(outputTxt)

}