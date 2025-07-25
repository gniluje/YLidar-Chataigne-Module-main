//For more information on the product, check https://www.ydlidar.com/product/ydlidar-g2 and https://dedjh0j7jhutx.cloudfront.net/2036899223840006144/0a0bd6eb3b832ab36a363b58ed00b952.pdf
//For more information on the protocol, check : https://github.com/YDLIDAR/YDLidar-SDK/blob/master/doc/YDLidar-SDK-Communication-Protocol.md

// Number of angular steps (1 degree resolution for 360 degrees)
var angleSteps = 360; //1 degre resolution
// Number of data rows per point: angle/distance/intensity or X/Y/intensity
var rows = 3; //angle, distance, intensity or X, Y, intensity

// Index used to animate a single radar point across the scan
var radarIndex = 0;

// Array to store polar coordinates (angle, distance, intensity) for each degree
var arrayPol360 = []; 
// Array to store Cartesian coordinates (X, Y, intensity) for each degree
var arrayXY360 = [];
// Temporary 3D point used for radar visualization in Chataigne
var XYRadar = [0.0,0.0,0.0]; 
// Temporary 3D point used for radar visualization in Chataigne
var polRadar = [0.0,0.0,0.0];

// Start angle of the current LIDAR scan packet
var start_angle = 0;
// End angle of the current LIDAR scan packet
var end_angle = 0;
// Angular difference between start and end angles
var diff_angle = 0;

// Intensity value of the LIDAR return signal
var intensity = 0;
// Distance value measured by the LIDAR
var distance = 0;
// Interpolated angle for each sample point
var inter_angle = 0;

// Corrected angle after applying LIDAR-specific calibration
var angle_correct = 0;
// Angle in radians used for trigonometric calculations
var radians = 0;         
// X coordinate in Cartesian space
var pos_x = 0;
// Y coordinate in Cartesian space
var pos_y = 0;

// Frequency of the LIDAR scan
var frequency = 0;
// Type of data packet received from LIDAR
var packetType = 0;
// Number of sample points in the current scan packet
var sampleCount = 0;
// First sample angle bytes (LSB and MSB)
var fsa1 = 0;
// First sample angle bytes (LSB and MSB)
var fsa2 = 0;
// Last sample angle bytes (LSB and MSB)
var lsa1 = 0;
// Last sample angle bytes (LSB and MSB)
var lsa2 = 0;

// Flag indicating whether the current data chunk should be processed
var processChunk = 0;
// Array holding the raw data bytes from the LIDAR
var dataChunk = [];

// Initializes the data structures and parameters for LIDAR visualization.
function init() {

    for(var i = 0; i < angleSteps; i++) {
    arrayPol360[i] = []; 
    arrayXY360[i] = [];
      for(var j = 0; j < rows; j++) {
        arrayPol360[i][j] = (j==0) * i; // Assign a value -- one column = 1 degree
        arrayXY360[i][j] = 0;
      }
      local.values.polarCoords.addPoint3DParameter(i, "");
      local.values.polarCoords.getChild(i).setAttribute("readonly",true);
      local.values.xyCoords.addPoint3DParameter(i, "");
      local.values.xyCoords.getChild(i).setAttribute("readonly",true);
    }

    script.updateRate.set(local.parameters.updateRate.get());
    script.log("YLidarG2 module init done");
}

// Handles changes in module parameters, such as connection status or update rate.
function moduleParameterChanged(param) { //event trigged when a parameter is modified

    if (param.isParameter()) { //parameter change management
        script.log(param.name + " parameter changed, new value: " + param.get());

        if (param.is(local.parameters.isConnected)) {
          //TBD
        } else if (param.is(local.parameters.updateRate)) {
          script.updateRate.set(param.get()); //update rate parameter management, could be decreased a bit if heavy serial load
        }
    } else { //trigger click management
        script.log(param.name + " trigger clicked");
        if (param.is(local.parameters.startLidar)) { //trigger enabling to set all the relays ON
            local.sendBytes(0xa5,0x60);
        } else if (param.is(local.parameters.stopLidar)) { //trigger enabling to set all the relays OFF
            local.sendBytes(0xa5,0x65);
        }
    }
}

// Handles changes in module values (not used actively in this script).
function moduleValueChanged(value) { //event trigged when a value is modified
    //script.log(value.name + " value changed, new value: " + value.get());
}

// Main update loop that processes the LIDAR data chunk and updates the visualization arrays.
function update(deltaTime) { //loop function, delta time can be changed thanks to : script.updateRate.set([your update rate]);
    if (local.parameters.isConnected.get() && processChunk) {
      
        fsa1 = parseInt(dataChunk[4]);
        fsa2 = parseInt(dataChunk[5]);
        lsa1 = parseInt(dataChunk[6]);
        lsa2 = parseInt(dataChunk[7]);

        start_angle = firstLevelAngle(fsa1, fsa2);
        end_angle = firstLevelAngle(lsa1, lsa2);
        diff_angle = diffAngle(end_angle, start_angle);

        script.log("start_angle = " + start_angle + " " + "end_angle = " + end_angle + " " + "diff_angle = " + diff_angle);

        for (var i = 0; i < sampleCount; i++) {
            base = 10 + 3 * i;
            // Light intensity calculation
            intensity = dataChunk[base] + (dataChunk[base + 1] & 3) * 256;
            // Distance calculation
            distance = ((dataChunk[base + 1] >> 2) | (dataChunk[base + 2] << 6));

            if (i > 0 && i < sampleCount - 1) {
                inter_angle = interAngle(i, diff_angle, sampleCount, start_angle);
            } else if (i === 0) {
                inter_angle = start_angle;
            } else if (i === sampleCount - 1) {
                inter_angle = end_angle;
            }

            angle_correct = angleCorrect(inter_angle, distance);
            //x and y corrdinates calculation
            radians = angle_correct * Math.PI / 180.;
            pos_x = distance * Math.cos(radians);
            pos_y = distance * Math.sin(radians);
            
            angle_correct_floored = (Math.floor(angle_correct+0.5)) % 360;

            arrayPol360[angle_correct_floored][0] = angle_correct;
            arrayPol360[angle_correct_floored][1] = distance;
            arrayPol360[angle_correct_floored][2] = intensity;
            arrayXY360[angle_correct_floored][0] = pos_x;
            arrayXY360[angle_correct_floored][1] = pos_y;
            arrayXY360[angle_correct_floored][2] = intensity;
        }

        for(var i = 0; i < angleSteps; i++) {
          if(arrayPol360[i][1] > 0 && arrayPol360[i][2] > 0){
            local.values.polarCoords.getChild(i).set([arrayPol360[i][0],arrayPol360[i][1],arrayPol360[i][2]]);
            local.values.xyCoords.getChild(i).set([arrayXY360[i][0],arrayXY360[i][1],arrayXY360[i][2]]);
          }
          else{
            //TBD
          }
        }       
      
        local.values.polRadar.set([arrayPol360[radarIndex][0],arrayPol360[radarIndex][1],arrayPol360[radarIndex][2]]);
        local.values.xyRadar.set([arrayXY360[radarIndex][0],arrayXY360[radarIndex][1],arrayXY360[radarIndex][2]]);
        radarIndex = (radarIndex + 1)*(1 - (radarIndex == (angleSteps - 1))); 
        processChunk = 0;
    }
}

// Handles incoming serial data from the LIDAR and validates it before processing.
function dataReceived(data) { //serial received management
   
    frequency = (data[2] >> 1) / 10.0;
    packetType = data[2] & 0x01;
    sampleCount = data[3];

    if(sampleCount != 1){
        if(checkCode(data)){
            script.log("Données valides");
            cloneArray(data,dataChunk);
            processChunk = 1;          
        } else {
            script.log("Données invalides");
        }
    }
}

// Computes the angle from two bytes (LSB and MSB) using the LIDAR protocol.
function firstLevelAngle(lsb, msb) {
    return ((lsb | (msb << 8)) >> 1) / 64.0;
  }
  
// Calculates the difference between end and start angles, accounting for wrap-around.
function diffAngle(endAngle, startAngle) {
    if (endAngle < startAngle) {
      endAngle += 360;
    }
    return endAngle - startAngle;
  }
  
// Computes the interpolated angle for a given sample index.
function interAngle(idx, diffAngle, lsn, startAngle) {
    var ret = (diffAngle / (lsn - 1)) * idx + startAngle;
    if (ret >= 360) {
      ret -= 360;
    }
    return ret;
  }

// Applies a correction to the angle based on the distance to improve accuracy.
function angleCorrect(angle, distance) {
    if (distance === 0) {
      return 0.0;
    }
    var radians = Math.atan2(21.8 * (155.3 - distance), 155.3 * distance);
    var corrected = angle + (radians * 180 / Math.PI);
    if (corrected < 0) {
      corrected += 360;
    }
    return corrected;
  } 

// Verifies the checksum of the received data to ensure integrity.
function checkCode(data) {
    var lenData = data.length;
    var lsn = parseInt(data[3]);
    var fsa1 = parseInt(data[4]); // LSB
    var fsa2 = parseInt(data[5]); // MSB
    var lsa1 = parseInt(data[6]); // LSB
    var lsa2 = parseInt(data[7]); // MSB
    var cs = parseInt(data[8]) | (parseInt(data[9]) << 8);
    var ph = parseInt(data[0]) | (parseInt(data[1]) << 8); // Header
  
    // Début du calcul du checksum
    var tmp_cs = ph ^ (data[2] | (data[3] << 8)); // CT et LSN
    tmp_cs = tmp_cs ^ (fsa1 | (fsa2 << 8));
    tmp_cs = tmp_cs ^ (lsa1 | (lsa2 << 8));
  
    for (var n = 0; n < lsn; n++) {
      var base = 10 + 3 * n;
      if (base + 2 >= lenData) {
        script.log("check code: index hors limites");
        break;
      }
      tmp_cs = tmp_cs ^ data[base];
      tmp_cs = tmp_cs ^ (data[base + 1] | (data[base + 2] << 8)); 
    }  
    return cs === tmp_cs;
  }
  
// Copies the contents of one array into another.
function cloneArray(sourceArray, destArray) {
  for (var i = 0; i < sourceArray.length; i++) {
    destArray[i] = sourceArray[i];
  }
}

// Converts a decimal number to its hexadecimal string representation.
function decimalToHex(decimal) {
    if (decimal === 0) {
      return "0";
    }
    var hexDigits = "0123456789ABCDEF";
    var result = "";
    var number = decimal;
  
    while (number > 0) {
      var remainder = number % 16;
      result = hexDigits.charAt(remainder) + result;
      number = Math.floor(number / 16);
    }
    return result;
  }
  