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
  let radioName = decodeURIComponent(request.params.name).replace(/\+/g, ' ');
  
  console.log("Opgevraagde radio-naam:", radioName);
  console.log("Beschikbare stations:", radiostations.map(s => s.name));

  const station = radiostations.find(station => station.name === radioName);

  if (!station) {
      return response.status(404).send('Radiostation niet gevonden');
  }

  // Haal de dag uit de querystring, standaard vandaag
  let selectedDay = request.query.day ? request.query.day.toLowerCase() : null;
  
  // const station = radiostations.find(station => station.id == radioId);

  console.log(`Geselecteerde dag: ${selectedDay}`);

  // Haal shows op en filter ze op het juiste station en dag
  const showsPerDayResponse = await fetch('https://fdnd-agency.directus.app/items/mh_day?fields=date,shows.mh_shows_id.from,shows.mh_shows_id.until,shows.mh_shows_id.show.body,shows.mh_shows_id.show.radiostation.*,shows.mh_shows_id.show.users.mh_users_id.*,shows.mh_shows_id.show.users.*.*');
  const showsPerDayResponseJSON = await showsPerDayResponse.json();

  // Zoek in de database naar de juiste dag
  const selectedDayShows = showsPerDayResponseJSON.data.find(({ date }) => {
      const dayOfWeek = new Date(date).getDay();
      return dayMapping[dayOfWeek] === selectedDay;
  });

  // Filter de programma's van de geselecteerde dag en het juiste radiostation
  const filteredShows = selectedDayShows?.shows
      .filter(show => show.mh_shows_id.show.radiostation.name === radioName)
      .map(show => ({
          from: show.mh_shows_id.from,
          until: show.mh_shows_id.until,
          body: show.mh_shows_id.show.body || "Geen informatie beschikbaar",
          userAvatar: show.mh_shows_id.show.users?.[0]?.mh_users_id?.cover || null
      })) || [];

  response.render('radio.liquid', { station, shows: filteredShows });
});



app.set('port', process.env.PORT || 8000)

// Start Express op, haal daarbij het zojuist ingestelde poortnummer op
app.listen(app.get('port'), function () {
  // Toon een bericht in de console en geef het poortnummer door
  console.log(`Application started on http://localhost:${app.get('port')}`)
})