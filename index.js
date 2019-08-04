

const express = require('express');
const app = express();
const fetch = require('node-fetch');

require('dotenv').config();
const API_KEY = process.env.API_KEY;

app.listen(3000, () => console.log("listening at port 3000"));
app.use(express.static('client'));
app.use(express.json());


app.get('/weather/:latitude/:longitude', async (request, response) => {
    //respond with a json 
    response.json(await loadWeather(request.params.latitude, request.params.longitude));
});

async function loadWeather(latitude, longitude) {
    let url = `https://api.darksky.net/forecast/${API_KEY}/${latitude},${longitude}`;

    const response = await fetch(url);
    const data = await response.json();

    let temperature = fahrenheitToCelsius(data.currently.temperature);
    let apparent_temperature = fahrenheitToCelsius(data.currently.apparentTemperature);
    let daytime_high = fahrenheitToCelsius(data.daily.data[0].temperatureMax);
    let daytime_low = fahrenheitToCelsius(data.daily.data[0].temperatureMin);
    let humidity = map(data.currently.humidity, 0, 1, 0, 100).toFixed(0);
    let wind_speed = milesToKilometers(data.currently.windSpeed);
    let wind_direction = bearingToCompass(data.currently.windBearing);
    let pressure = data.currently.pressure.toFixed(0);
    let clouds = map(data.currently.cloudCover, 0, 1, 0, 100).toFixed(0);
    let uv_index = data.currently.uvIndex;
    let visiblity = milesToKilometers(data.currently.visibility);
    let description = (data.currently.summary).toLowerCase();
    let precipitation = checkPrecipitation(data.currently);
    let precipitation_intensity = inchesTomillimeters(data.currently.precipIntensity);
    let precipitation_probability = map(data.currently.precipProbability, 0, 1, 0, 100).toFixed(0);

    let local_time = data.currently.time;
    let sunrise = data.daily.data[0].sunriseTime;
    let sunset = data.daily.data[0].sunsetTime;

    return {
        weather: { temperature, apparent_temperature, daytime_high, daytime_low, humidity, wind_speed, wind_direction, pressure, clouds, uv_index, visiblity, description, precipitation, precipitation_intensity, precipitation_probability },
        time: { local_time, sunrise, sunset }
    };
}


function fahrenheitToCelsius(temp) { //converts from fahrenheit to celsius and returns rounded value
    return ((temp - 32) * 5 / 9).toFixed(0);
}

function milesToKilometers(speed) { //convert miles to kilometers
    return (speed * 1.609).toFixed(0);
}
 
function inchesTomillimeters(dist) { //convert from inches to mm 
    return (dist * 25.4).toFixed(1);
}

function bearingToCompass(bearing) { //convert bearing to compass direction
    let directions = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
    return directions[map(bearing, 0, 360, 0, 15).toFixed(0)];
}

function checkPrecipitation(data_currently) { //get current precipitation type *pass in data.currently
    if (data_currently.hasOwnProperty('precipType')) {
        return data_currently.precipType;
    }
    return "none";
}

function map(value, input_start, input_end, output_start, output_end) { //map input value from starting range to new range
    return output_start + ((output_end - output_start) / (input_end - input_start)) * (value - input_start)
}
