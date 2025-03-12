// Importeer het npm package Express (uit de door npm aangemaakte node_modules map)
// Deze package is geïnstalleerd via `npm install`, en staat als 'dependency' in package.json
import express from 'express'

// Importeer de Liquid package (ook als dependency via npm geïnstalleerd)
import { Liquid } from 'liquidjs';


// console.log('Test')

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
// Bestanden in deze map kunnen dus door de browser gebruikt worden
app.use(express.static('public'))

// Stel Liquid in als 'view engine'
const engine = new Liquid();
app.engine('liquid', engine.express()); 

// Stel de map met Liquid templates in
// Let op: de browser kan deze bestanden niet rechtstreeks laden (zoals voorheen met HTML bestanden)
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

app.get('/radio/:name', async function (request, response) {
  let radioName = request.params.name.replace(/\+/g, ' ');
  console.log("Opgevraagde radio-naam:", radioName);
  console.log("Beschikbare stations:", radiostations.map(s => s.name));

  const station = radiostations.find(station => station.name === radioName);
  if (!station) {
    return response.status(404).send('Radiostation niet gevonden');
  }

  // Mapping van getal naar dagnaam (0 = zondag, 1 = maandag, etc.)
  const dayMapping = {
    1: "maandag",
    2: "dinsdag",
    3: "woensdag",
    4: "donderdag",
    5: "vrijdag",
    6: "zaterdag",
    0: "zondag"
  };

  // Bepaal de geselecteerde dag via queryparameter, default naar de huidige dag (of maandag als vandaag zondag is)
  let selectedDay = request.query.day ? request.query.day.toLowerCase() : null;
  if (!selectedDay || selectedDay === "zondag") {
    const currentDayNumber = new Date().getDay();
    selectedDay = (currentDayNumber === 0) ? "maandag" : dayMapping[currentDayNumber];
  }
  console.log("Geselecteerde dag:", selectedDay);

  // Haal de shows-per-dag op
  const showsPerDayResponse = await fetch('https://fdnd-agency.directus.app/items/mh_day?fields=date,shows.mh_shows_id.from,shows.mh_shows_id.until,shows.mh_shows_id.show.body,shows.mh_shows_id.show.radiostation.*,shows.mh_shows_id.show.users.mh_users_id.*,shows.mh_shows_id.show.users.*.*');
  const showsPerDayResponseJSON = await showsPerDayResponse.json();

  // Zoek het item dat overeenkomt met de geselecteerde dag (gebaseerd op de dagnaam)
  const selectedDayShows = showsPerDayResponseJSON.data.find(item => {
    const dayOfWeek = new Date(item.date).getDay();
    return dayMapping[dayOfWeek] === selectedDay;
  });

  
  const filteredShows = selectedDayShows?.shows
    .filter(show => show.mh_shows_id.show.radiostation.name === radioName)
    .map(show => ({
      from: show.mh_shows_id.from,
      until: show.mh_shows_id.until,
      body: show.mh_shows_id.show.body || "Geen informatie beschikbaar",
      userAvatar: show.mh_shows_id.show.users?.[0]?.mh_users_id?.cover || null
    })) || [];

  // Bereken de kalender (maandag t/m zaterdag) met de datum (dagnummer)
  const today = new Date();
  let monday;
  if (today.getDay() === 0) {
    // Als vandaag zondag is, stel maandag in als morgen
    monday = new Date(today);
    monday.setDate(today.getDate() + 1);
  } else {
    // Anders: bereken de maandag van deze week
    monday = new Date(today);
    monday.setDate(today.getDate() - (today.getDay() - 1));
  }

  let weekDays = [];
  const daysOfWeek = ["maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag"];
  for (let i = 0; i < 6; i++) {
    let d = new Date(monday);
    d.setDate(monday.getDate() + i);
    weekDays.push({
      day: daysOfWeek[i],
      // Gebruik het dagnummer voor weergave
      dayNumber: d.getDate()
    });
  }

  response.render('radio.liquid', { station, shows: filteredShows, weekDays, selectedDay });
});



app.set('port', process.env.PORT || 8000)

// Start Express op, haal daarbij het zojuist ingestelde poortnummer op
app.listen(app.get('port'), function () {
  // Toon een bericht in de console en geef het poortnummer door
  console.log(`Application started on http://localhost:${app.get('port')}`)
})