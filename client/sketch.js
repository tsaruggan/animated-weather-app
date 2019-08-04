
const search = document.getElementById('search'); //search input field 
const autocomplete = document.getElementById("autocomplete"); //container for storing autocomplete suggestions

let places; //array of place object *containing places.json*
let suggestions; //filtered autocomplete suggestions based on input 

var position = null; //current position data object
var weather = null; //current weather data object
var time = null; //current time data object 

var ready = false; //confirms that data is ready to display 


function preload() {
    initializeComponents();  //load places json and request browser geolocation to update data
}


function setup() {
    createEventListeners(); //create event listeners for the form elements
}

function draw() {
    displayWeather(ready); //update page's dom elements with data
}

//***THIS IS DOM STUFF**************************************** */
async function updateData(position) {
    let data = await getData(position.latitude, position.longitude); //makes a request to server for data from dark sky 
    this.position = position; //stores position object
    this.weather = data.weather; //stores weather object 
    this.time = data.time; //stores time object
    //print data to console with random color
    console.log(`%cRESPONSE: ${JSON.stringify({ "Position": position, "Weather": weather, "Time": time }, undefined, 1)}`, `color: ${color(random(150), random(150), random(150))}; font-family: Helvetica; font-size: 11pt; font-weight: bold;`);
    ready = true;
}

async function getData(latitude, longitude) { //makes a get request to server for data from dark sky api 
    let response = await fetch(`/weather/${latitude}/${longitude}`); //send longitude latuitude data in params fetch to server
    let data = await response.json();//convert stream to json and print
    return data;
}

function displayWeather(ready) { //update dom elements on screen
    if (ready) {
        document.getElementById("temperature").innerHTML = `${weather.temperature}\xB0C`;
        document.getElementById("condition").innerHTML = weather.description;
        document.getElementById("location").innerHTML = `${position.name},${position.country}`;
        document.getElementById("feelsLike").innerHTML = `${weather.apparent_temperature}\xB0C`;
        document.getElementById("daytimeHigh").innerHTML = `${weather.daytime_high}\xB0C`;
        document.getElementById("daytimeLow").innerHTML = `${weather.daytime_low}\xB0C`;
        document.getElementById("humidity").innerHTML = `${weather.humidity}%`;
        document.getElementById("wind").innerHTML = `${weather.wind_direction} ${weather.wind_speed} km/h`;
        document.getElementById("pressure").innerHTML = `${weather.pressure} hPa`;
        document.getElementById("clouds").innerHTML = `${weather.clouds}%`;
        document.getElementById("uvIndex").innerHTML = `${weather.uv_index}`;
        document.getElementById("precipitation").innerHTML = `${weather.precipitation_intensity} mm (${weather.precipitation_probability}%)`;
        toggleVisibility(true); //make dom visible
    }
}

async function loadPlacesJSON(filename) {
    const response = await fetch("places.json"); //load local file places.json
    places = await response.json(); //convert data strwam to json 
}


function getPosition(latitude, longitude) {

    for (var index = 0; index < places.length; index++) {

        let lat = Number(places[index].lat).toFixed(1);
        let lng = Number(places[index].lng).toFixed(1);

        if (lat == latitude && lng == longitude) { // checks each plac object in places.json for matching latitude and longitude
            let name = places[index].name;
            country = places[index].country;
            return { name, country, latitude, longitude };
        }
    }
    return null; //if not found then return null 
}

async function initializeComponents() {

    await loadPlacesJSON(); //load places JSON file before displaying

    if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition((geo) => {
            let position = getPosition(geo.coords.latitude.toFixed(1), geo.coords.longitude.toFixed(1)); //get position based on latitude and longitude
            updateData(position); //update data so it can be dispalyed
        });
    }
}

function toggleVisibility(visible) { //turns on or off the display 
    if (visible === true) {
        document.body.style.display = 'block';
        ready = false;
    } else if (visible === false) {
        document.body.style.display = 'none';
        ready = true;
    }
}

function createEventListeners() {
    search.addEventListener('input', filterSuggestions);
    search.addEventListener('keypress', preventSubmit);
    autocomplete.addEventListener('mousedown', selectSuggestion);
    search.addEventListener('focusout', clearSearch);
}

function preventSubmit(e) { //prevent form submission when user hits enter
    var key = e.charCode || e.keyCode || 0;
    if (key == 13) {
        e.preventDefault();
    }
}

function hideSuggestions() { //when user focuses out of field, hide the autocomplete suggestions
    setTimeout(() => { search.value = ''; }, 100); //the timeout is a bug fix for preventing suggestion selection to be triggered
}


function selectSuggestion(evt) { //select a suggestion from autocomplete dropdown
    let matches = Array.prototype.slice.call(document.querySelectorAll("div")); //creates an array of all autocomplete div elements
    let index = matches.indexOf(evt.target); //holds the idex of div that triggered event

    let current = matches[index];
    //grab the data contained in the data- attribute and pass to updateData
    let name = current.dataset.name;
    let country = current.dataset.country;
    let latitude = current.dataset.latitude;
    let longitude = current.dataset.longitude;

    toggleVisibility(false); //turn off visibility
    updateData({ name, country, latitude, longitude });
    clearSearch(); //clear the search bar
}

function clearSearch() { //clear the search bar and hide the autocomplete suggestions
    search.value = '';
    autocomplete.innerHTML = '';
}

function filterSuggestions() {
    autocomplete.innerHTML = ''; //clear the suggestions 
    suggestions = places.filter(checkMatch); //filter the places json based on checkMatch condition *stores array 

    if (search.value === '') { //if search value is empty then clear 
        autocomplete.innerHTML = '';
    } else {
        displaySuggestions(suggestions, 20); //if search bar has text then display the suggestions up to 20 
    }
}

function checkMatch(place) { //return true if place from places json matches the following condition
    var search_term = search.value.toLocaleLowerCase(); //search term is value of input field 
    return place.name.toLocaleLowerCase().indexOf(search_term) == 0; //return true if the search term is the beginning of the name of the places object 
}

function generateListitem(suggested) { //create and return a div with the suggested place object
    const div = document.createElement('div');
    div.innerHTML = `${suggested.name}, ${suggested.country}`; //text value
    //store information of suggested place object to the div data- attribute(s)
    div.dataset.name = suggested.name;
    div.dataset.country = suggested.country;
    div.dataset.latitude = Number(suggested.lat).toFixed(3);
    div.dataset.longitude = Number(suggested.lng).toFixed(3);
    return div;
}

function displaySuggestions(suggestions, limit) {
    var frag = document.createDocumentFragment(); //append created div elements to frag then append frag to page to reduce dom changes for efficiency
    for (var i = 0; i < suggestions.length; i++) { //created 
        if (i < limit) {
            let item = generateListitem(suggestions[i]); //generate div 
            frag.append(item);
        } else {
            break;
        }
    }
    autocomplete.appendChild(frag);
}