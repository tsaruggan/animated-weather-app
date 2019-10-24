
var canvas;
var turbidity;
var solar_position;
var solar_zenith;
var solar_azimuth;
var zen_abs;
var coeffs_mtx;
var alpha;

var clouds;
var precipitation;

function setup() {
    canvas = createCanvas(windowWidth, windowHeight, WEBGL); //initialize canvas at window size with WEBGL
}


function draw() {
    background(0); //initialize background to black
    perspective(PI / 3.0, width / height, 200, ((height / 2.0) / tan(PI * 60.0 / 360.0)) * 10.0) //default perspective and clip anything at z = 200 or greater


    if (position && time && weather) { //ensure that the data exists from async fetch request

        if (changed) { //if the data is changed at any point, refresh
            displayWeather(ready); //update page's dom elements with data
            turbidity = CalculateTurbidity(); //calculate the turbidity value
            solar_position = CalculateSolarPosition(position, time); //return zenith and azimuth values
            solar_zenith = solar_position.solar_zenith;
            solar_azimuth = solar_position.solar_azimuth;
            zen_abs = CalculateZenitalAbsolutes(turbidity, solar_zenith); //get zenital absolutes based on turbidity
            coeffs_mtx = CalculateCoefficents(turbidity); //calculate A B C D E coefficients
            alpha = CalculateAlpha(time.local_time, time.sunrise, time.sunset);
            clouds = new Clouds(weather.clouds, cloud_models, weather.wind_speed, weather.wind_bearing, weather.uv_index); //create clouds
            precipitation = new Precipitation(weather.precipitation, weather.precipitation_intensity); // create precipitation

            changed = false; //turn changed off
        }

        drawSkyColour(64, 36, zen_abs, solar_zenith, solar_azimuth, coeffs_mtx, alpha); //simulate sky colours
        clouds.simulate(); //simulate cloud movement
        precipitation.simulate(); //simulate precipitation
    }
}

function windowResized() { //if window is resized then resize canvas and make changed true 
    resizeCanvas(windowWidth, windowHeight);
    changed = true;
}


function drawSkyColour(resolution_x, resolution_y, zen_abs, solar_zenith, solar_azimuth, coeffs_mtx, alpha) { //creates rectangles on background resembling pixels
    var scale_x = width;
    var scale_y = height;
    for (var row = 0; row < 1; row += (1 / resolution_y)) {
        for (var col = 0; col < 1; col += (1 / resolution_x)) {
            azimuth = radians(map(col, 0, 1, -180, 180));
            zenith = radians(map(row, 0, 1, 0, 90));

            var rgb = Calc_Sky_RGB(zenith, azimuth, zen_abs, solar_zenith, solar_azimuth, coeffs_mtx);
            noStroke();
            fill(rgb.r, rgb.g, rgb.b, alpha);


            var y = row * scale_y - windowHeight / 2;
            var x = col * scale_x - windowWidth / 2;
            rect(x, y, scale_x / resolution_x, scale_y / resolution_y);
        }
    }
}

function CalculateTurbidity() { //function that estimates turbidity in region using humidity and ozone; values ranging (2-8)
    var o = max(map(weather.ozone, 275, 500, 0, 85), 5);
    var h = map(weather.humidity, 0, 100, 0, 15);

    var t = map(o + h, 0, 125, 0, 6) + 2;
    return t;
}

function CalculateSolarPosition(position, time) { //calculates and returns the solar zenith and azimuth
    //convert the current latitude and longitude into radians
    var longitude = radians(position.longitude);
    var latitude = radians(position.latitude);

    var date = unixToDate(time.local_time); //converts the unix time to current date
    var julian = day_of_year(date) //calculates the day of th year out of 365
    var total_hours_today = date.getHours(); //the hours passed in the day

    //formula for calculating the solar time
    var solar_time =
        total_hours_today +
        0.170 * Math.sin((4 * Math.PI * (julian - 80)) / 373) -
        0.129 * Math.sin((2 * Math.PI * (julian - 8)) / 355) +
        (12 * (25 - longitude) / Math.PI);

    // formula for calculating declination of the sun    
    var declination = 0.4093 * Math.sin(2 * Math.PI * (julian - 81) / 368);

    //break down of formula for calculating zenith and azimuth
    var sin_l = Math.sin(latitude);
    var cos_l = Math.cos(latitude);
    var sin_d = Math.sin(declination);
    var cos_d = Math.cos(declination);
    var cos_pi_t_12 = Math.cos(Math.PI * solar_time / 12);
    var sin_pi_t_12 = Math.sin(Math.PI * solar_time / 12);

    var solar_zenith = Math.PI / 2 - Math.asin(sin_l * sin_d - cos_l * cos_d * cos_pi_t_12);
    var solar_azimuth = Math.atan2((-cos_d * sin_pi_t_12), (cos_l * sin_d - sin_l * cos_d * cos_pi_t_12));

    return { "solar_zenith": solar_zenith, "solar_azimuth": solar_azimuth }; //return as object
}

function CalculateAlpha(time, sunrise, sunset) {

    const six_hours = 21600;
    const min_a = 50;
    const max_a = 100;

    if (time < sunrise) {
        return map(abs(sunrise - time), 0, six_hours, min_a, max_a);
    } else if (time > sunset) {
        return map(abs(sunset - time), 0, six_hours, min_a, max_a);
    }
    return 100;
}


function CalculateZenitalAbsolutes(turbidity, solar_zenith) { //calculating Yz, xz and yz values
    var za = {}
    var Yz = (4.0453 * turbidity - 4.9710) * Math.tan((4 / 9 - turbidity / 120) * (Math.PI - 2 * solar_zenith)) - 0.2155 * turbidity + 2.4192;
    var Y0 = (4.0453 * turbidity - 4.9710) * Math.tan((4 / 9 - turbidity / 120) * (Math.PI)) - 0.2155 * turbidity + 2.4192;
    //Y0 = 40;
    za.Yz = Yz / Y0; //normalizing the value

    var z3 = Math.pow(solar_zenith, 3);
    var z2 = Math.pow(solar_zenith, 2);
    var z = solar_zenith;
    var T_vec = [turbidity * turbidity, turbidity, 1.0];

    var x = [
        0.00166 * z3 - 0.00375 * z2 + 0.00209 * z + 0,
        -0.02903 * z3 + 0.06377 * z2 - 0.03202 * z + 0.00394,
        0.11693 * z3 - 0.21196 * z2 + 0.06052 * z + 0.25886];
    za.xz = T_vec[0] * x[0] + T_vec[1] * x[1] + T_vec[2] * x[2]; // dot(T_vec, x);

    var y = [
        0.00275 * z3 - 0.00610 * z2 + 0.00317 * z + 0,
        -0.04214 * z3 + 0.08970 * z2 - 0.04153 * z + 0.00516,
        0.15346 * z3 - 0.26756 * z2 + 0.06670 * z + 0.26688];
    za.yz = T_vec[0] * y[0] + T_vec[1] * y[1] + T_vec[2] * y[2]; // dot(T_vec, y);
    return za; //object with properities Yz, xz and yz
}

function CalculateCoefficents(turbidity) { //calculating cofficients A B C D E based on turbidity
    var cie = {};
    var coeffsY = {};
    coeffsY.A = 0.1787 * turbidity - 1.4630;
    coeffsY.B = -0.3554 * turbidity + 0.4275;
    coeffsY.C = -0.0227 * turbidity + 5.3251;
    coeffsY.D = 0.1206 * turbidity - 2.5771;
    coeffsY.E = -0.0670 * turbidity + 0.3703;
    cie.coeffsY = coeffsY;

    var coeffsx = {};
    coeffsx.A = -0.0193 * turbidity - 0.2592;
    coeffsx.B = -0.0665 * turbidity + 0.0008;
    coeffsx.C = -0.0004 * turbidity + 0.2125;
    coeffsx.D = -0.0641 * turbidity - 0.8989;
    coeffsx.E = -0.0033 * turbidity + 0.0452;
    cie.coeffsx = coeffsx;

    var coeffsy = {};
    coeffsy.A = -0.0167 * turbidity - 0.2608;
    coeffsy.B = -0.0950 * turbidity + 0.0092;
    coeffsy.C = -0.0079 * turbidity + 0.2102;
    coeffsy.D = -0.0441 * turbidity - 1.6537;
    coeffsy.E = -0.0109 * turbidity + 0.0529;
    cie.coeffsy = coeffsy;
    return cie;
}

function Perez(zenith, gamma, coeffs) { //perez function
    return (1 + coeffs.A * Math.exp(coeffs.B / Math.cos(zenith + 0.01))) *
        (1 + coeffs.C * Math.exp(coeffs.D * gamma) + coeffs.E * Math.pow(Math.cos(gamma), 2));
}

function gamma_correct(v) { //used in Yxy to RGB conversion
    v = Math.max(v, 0);
    return Math.max(Math.min(Math.pow(v, (1 / 1.8)), 1), 0);
}

function Yxy_to_RGB(Y, x, y) { //converting Yxy color to RGB color for single pixel 
    var X = x / y * Y;
    var Z = (1.0 - x - y) / y * Y;
    return {
        r: gamma_correct(3.2406 * X - 1.5372 * Y - 0.4986 * Z) * 255,
        g: gamma_correct(-0.9689 * X + 1.8758 * Y + 0.0415 * Z) * 255,
        b: gamma_correct(0.0557 * X - 0.2040 * Y + 1.0570 * Z) * 255
    };
}

function Gamma(zenith, azimuth, solar_zenith, solar_azimuth) { //calculating gamma value using sun position
    var ret = Math.acos(
        Math.sin(solar_zenith) * Math.sin(zenith) * Math.cos(azimuth - solar_azimuth) + Math.cos(solar_zenith) * Math.cos(zenith));
    return ret;
}

function Calc_Sky_RGB(zenith, azimuth, zen_abs, solar_zenith, solar_azimuth, coeffs_mtx) { //calculating the sky color for given position and coefficients
    zenith = Math.min(zenith, Math.PI / 2.0 - 0.01) + 0.01;
    var gamma = Gamma(zenith, azimuth, solar_zenith, solar_azimuth);
    var Yp = zen_abs.Yz * Perez(zenith, gamma, coeffs_mtx.coeffsY) / Perez(0.0, solar_zenith, coeffs_mtx.coeffsY);
    var xp = zen_abs.xz * Perez(zenith, gamma, coeffs_mtx.coeffsx) / Perez(0.0, solar_zenith, coeffs_mtx.coeffsx);
    var yp = zen_abs.yz * Perez(zenith, gamma, coeffs_mtx.coeffsy) / Perez(0.0, solar_zenith, coeffs_mtx.coeffsy);

    return Yxy_to_RGB(Yp, xp, yp);
}

function day_of_year(date) { //determine day in the year out of 365
    var start = new Date(date.getFullYear(), 0, 0);
    var diff = date - start;
    var oneDay = 1000 * 60 * 60 * 24;
    var day = Math.floor(diff / oneDay);
    return day;
}

function unixToDate(unix) { //converitng unix time to Date format
    return new Date(unix * 1000);
}

class Cloud {
    constructor(clouds, wind_speed, wind_bearing, uv) {

        this.model = clouds[floor(random(clouds.length))]; //choose a random cloud model
        this.scale = random(0.5, 2); //scale it to a random size 

        //randomize starting positions
        this.x = random(-width / 2, width / 2);
        this.y = random(-height / 2, height / 2);
        this.z = random(-1000, 0);

        //calculate speed direction (plus some variation) based on wind speed
        this.vx = -sin(radians(wind_bearing)) * wind_speed / 2 * random(0.95, 1.05);
        this.vz = cos(radians(wind_bearing)) * wind_speed / 2 * random(0.95, 1.05);

        this.rot = random(-HALF_PI, HALF_PI); //factor of rotation
        var uv = uv;
        this.shade = map(uv, 0, 6, 0, 200) + random(0, 55); //colour clouds based on current uv index

        return;
    }

    display() { //displaying fucnctionality
        directionalLight(255, 255, 255, 0, -100, 0);

        pointLight(255, 255, 255, 0, -100, 0);
        //ambientMaterial(255);

        fill(this.shade, 50);

        scale(this.scale);
        model(this.model);
        pop();
    }

    move() { //moving functionality
        push();
        rotateX(this.rot * 0.7);
        rotateY(this.rot * 0.5);
        rotateZ(this.rot * 0.01);
        translate(this.x, this.y, this.z);
        this.z += this.vz;
        this.x += this.vx;
    }

    simulate() {
        this.move();
        this.display();
    }

    check() {
        if (abs(this.x) > width || this.z > 1000 || this.z < -2000) {
            return true;
        }
        return false;
    }

    respawn() {
        this.x = random(-width / 2, width / 2);
        this.y = random(-height / 2, height / 2);
        this.z = random(-1000, 0);
        this.scale = random(0.5, 2);
        this.rot = random(-HALF_PI, HALF_PI);
    }
}

class Clouds {

    constructor(percentage, cloud_models, wind_speed, wind_bearing, uv) {
        this.clouds = [];

        for (var i = 0; i < percentage * 2 / 3; i++) {
            this.clouds.push(new Cloud(cloud_models, wind_speed, wind_bearing, uv));
        }
    }

    simulate() {
        for (var i = 0; i < this.clouds.length; i++) {
            this.clouds[i].simulate();

            if (this.clouds[i].check()) {
                this.clouds[i].respawn();
            }
        }
    }

}

class Drop {

    constructor(type, intensity) {
        this.type = type;
        this.intensity = intensity;

        this.x = random(-width / 2, width / 2);
        this.y = random(-height, height);
        this.z = random(-1000, 100);

        this.v = random(0, 3);

        if (this.type == "rain") {
            this.alpha = random(5, 20);
            this.a = 0.5;
            this.scale = random(10, 20);

        } else if (this.type == "snow") {
            this.alpha = random(50, 100);
            this.a = 0.2;
            this.scale = random(1, 3)
        } else if (this.type == "sleet") {
            this.alpha = random(5, 100);
            this.a = random(0.2, 0.5);
            this.scale = random(0.1, 4)
        }
    }

    simulate() {
        push();

        fill(255, this.alpha);
        this.v += this.a;
        this.y += this.v;

        translate(this.x, this.y, this.z);

        if (this.type == "rain") {
            cylinder(1.5, this.scale);
        } else if (this.type == "snow") {
            sphere(this.scale);
        } else if (this.type == "sleet") {
            sphere(this.scale);
        }

        pop();
    }

    check() {
        if (this.y > height) {
            return true;
        }
        return false;
    }

    respawn() {
        this.x = random(-width / 2, width / 2);
        this.y = -height / 2 - 100;
        this.z = random(-1000, 100);
        this.v = 0;
    }

}

class Precipitation {

    constructor(type, intensity) {

        this.precipitation = [];

        for (var i = 0; i < pow(min(intensity * 10, 25), 2); i++) {
            this.precipitation.push(new Drop(type, intensity));
        }
    }

    simulate() {
        for (var i = 0; i < this.precipitation.length; i++) {
            this.precipitation[i].simulate();
            if (this.precipitation[i].check()) {
                this.precipitation[i].respawn();
            }
        }
    }
}

