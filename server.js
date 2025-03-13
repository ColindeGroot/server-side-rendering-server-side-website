// Importeer het npm package Express (uit de door npm aangemaakte node_modules map)
// Deze package is geïnstalleerd via `npm install`, en staat als 'dependency' in package.json
import express from 'express'

// Importeer de Liquid package (ook als dependency via npm geïnstalleerd)
import { Liquid } from 'liquidjs';

//alleen radio word nog gebruikt
const showsResponse = await fetch('https://fdnd-agency.directus.app/items/mh_shows');
const showsResponseJSON = await showsResponse.json();

const showResponse = await fetch('https://fdnd-agency.directus.app/items/mh_show');
const showResponseJSON = await showResponse.json();

const usersResponse = await fetch('https://fdnd-agency.directus.app/items/mh_users');
const usersResponseJSON = await usersResponse.json();

const radiostationsResponse = await fetch('https://fdnd-agency.directus.app/items/mh_radiostations');
const radiostationsResponseJSON = await radiostationsResponse.json();

const chatsResponse = await fetch('https://fdnd-agency.directus.app/items/mh_chats');
const chatsResponseJSON = await chatsResponse.json();

const radiostations = radiostationsResponseJSON.data.map(station => ({
  id: station.id,
  name: station.name
}));


// Maak een nieuwe Express applicatie aan, waarin we de server configureren
const app = express()

// Gebruik de map 'public' voor statische bestanden (resources zoals CSS, JavaScript, afbeeldingen en fonts)
app.use(express.static('public'))

// Stel Liquid in als 'view engine'
const engine = new Liquid();
app.engine('liquid', engine.express()); 

// Stel de map met Liquid templates in
app.set('views', './views')

// Maak een GET route voor de index (meestal doe je dit in de root, als /)
app.get('/', async function (request, response) {
   response.render('index.liquid', {radiostations: radiostationsResponseJSON.data})
})

// Maak een POST route voor de index; hiermee kun je bijvoorbeeld formulieren afvangen
// Hier doen we nu nog niets mee, maar je kunt er mee spelen als je wilt
app.post('/', async function (request, response) {
  response.redirect(303, '/')
})

// Helper om een tijd (HH:MM) om te rekenen naar minuten na middernacht
function timeToMinutes(time) {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

app.get('/radio/:name', async function (request, response) {
  let radioName = request.params.name.replace(/\+/g, ' ');
  console.log("Opgevraagde radio-naam:", radioName);
  console.log("Beschikbare stations:", radiostations.map(s => s.name));

  const station = radiostations.find(station => station.name === radioName);
  if (!station) {
    return response.status(404).send('Radiostation niet gevonden');
  }

  // Day mapping (0 = zondag, 1 = maandag, etc.)
  const dayMapping = {
    1: "maandag",
    2: "dinsdag",
    3: "woensdag",
    4: "donderdag",
    5: "vrijdag",
    6: "zaterdag",
    0: "zondag" // zondag heeft geen data
  };

  // Bepaal de geselecteerde dag via queryparameter, default naar de huidige dag (of maandag als vandaag zondag is)
  let selectedDay = request.query.day ? request.query.day.toLowerCase() : null;
  if (!selectedDay || selectedDay === "zondag") {
    const currentDayNumber = new Date().getDay();
    selectedDay = (currentDayNumber === 0) ? "maandag" : dayMapping[currentDayNumber];
  }
  console.log("Geselecteerde dag:", selectedDay);

  // Haal de shows-per-dag op
  const showsPerDayResponse = await fetch('https://fdnd-agency.directus.app/items/mh_day?fields=date,shows.mh_shows_id.from,shows.mh_shows_id.until,shows.mh_shows_id.show.body,shows.mh_shows_id.show.name,shows.mh_shows_id.show.radiostation.*,shows.mh_shows_id.show.users.mh_users_id.*,shows.mh_shows_id.show.users.*.*');
  const showsPerDayResponseJSON = await showsPerDayResponse.json();

  // Zoek het item dat overeenkomt met de geselecteerde dag (gebaseerd op de dagnaam)
  const selectedDayShows = showsPerDayResponseJSON.data.find(item => {
    const dayOfWeek = new Date(item.date).getDay();
    return dayMapping[dayOfWeek] === selectedDay;
  });

  // Filter de programma's voor het radiostation hulp van chad om een find en map te gebruiken ipv return functie
  const filteredShows = selectedDayShows?.shows
    .filter(show => show.mh_shows_id.show.radiostation.name === radioName)
    .map(show => ({
      from: show.mh_shows_id.from,
      until: show.mh_shows_id.until,
      title: show.mh_shows_id.show.name || "Geen titel beschikbaar",
      body: show.mh_shows_id.show.body || "Geen informatie beschikbaar",
      userAvatar: show.mh_shows_id.show.users?.[0]?.mh_users_id?.cover || null
    })) || [];

  // Als er geen shows zijn, voorkom dan fouten bij de berekening
  if (filteredShows.length === 0) {
    return response.render('radio.liquid', { 
      station, 
      shows: [], 
      weekDays: [], 
      selectedDay, 
      timeSlots: [] 
    });
  }

  // Bereken de vroegste en laatste tijd uit de shows 
  const startTimes = filteredShows.map(show => timeToMinutes(show.from));
  const endTimes = filteredShows.map(show => timeToMinutes(show.until));
  const earliest = Math.min(...startTimes);
  const latest = Math.max(...endTimes);


  const slotDuration = 60; // een uur per table item
  const totalSlots = Math.ceil((latest - earliest) / slotDuration);

  // Voor elke show: bereken de start-slot index en het aantal slots (colspan)
  filteredShows.forEach(show => {
    const showStart = timeToMinutes(show.from);
    const showEnd = timeToMinutes(show.until);
    show.slotStart = Math.floor((showStart - earliest) / slotDuration);
    show.colspan = Math.ceil((showEnd - showStart) / slotDuration);
  });

  // Bouw een array met tijdlabels voor de header
  let timeSlots = [];
  for (let i = 0; i <= totalSlots; i++) {
    const minutes = earliest + i * slotDuration;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    // met padstart er voor zorgen dat er 00 achterkomt voor de tijd. ( 15 - 15:00 )
    const label = `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
    timeSlots.push(label);
  }

  // zelf nog ff mee spelen op test omgeving gezoen 
  const today = new Date();
  let monday;
  if (today.getDay() === 0) {
    monday = new Date(today);
    monday.setDate(today.getDate() + 1);
  } else {
    monday = new Date(today);
    monday.setDate(today.getDate() - (today.getDay() - 1));
  }

  // object met datums waar er op gefilterd gaat worden
  let weekDays = [];
  const daysOfWeek = ["maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag"];
  for (let i = 0; i < 6; i++) {
    let d = new Date(monday); //begin filter maandag
    d.setDate(monday.getDate() + i);
    weekDays.push({
      day: daysOfWeek[i],
      dayNumber: d.getDate()
    });
  }

  response.render('radio.liquid', { 
    station, 
    shows: filteredShows, 
    weekDays, 
    selectedDay, 
    timeSlots, 
    totalSlots 
  });
});

app.set('port', process.env.PORT || 8000)


app.listen(app.get('port'), function () {
 
  console.log(`Application started on http://localhost:${app.get('port')}`)
})