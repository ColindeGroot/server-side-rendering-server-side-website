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
  // Je zou hier data kunnen opslaan, of veranderen, of wat je maar wilt
  // Er is nog geen afhandeling van een POST, dus stuur de bezoeker terug naar /
  response.redirect(303, '/')
})


app.get('/radio/:id', async function (request, response) {
  const radioId = parseInt(request.params.id);
  // Zoek het juiste radiostation op basis van de ID
  const showsPerDayResponse = await fetch('https://fdnd-agency.directus.app/items/mh_day?fields=date,shows.mh_shows_id.from,shows.mh_shows_id.until,shows.mh_shows_id.show.body,shows.mh_shows_id.show.radiostation.*,shows.mh_shows_id.show.users.mh_users_id.*,shows.mh_shows_id.show.users.*.*');
  const showsPerDayResponseJSON = await showsPerDayResponse.json();

  const todaysWeekDay = new Date().getDay();
  const todayShows = showsPerDayResponseJSON.data.filter(({ date }) => new Date(date).getDay() === todaysWeekDay)[0];
  
  const todayShowsForRadioStation = []; 
  
  todayShows.shows.forEach(show => {
    if (show.mh_shows_id.show.radiostation.id === radioId) {
      const showObj = {
        from: show.mh_shows_id.from,
        until: show.mh_shows_id.until,
        body: show.mh_shows_id.show.body,
        // userAvatar: show.mh_shows_id.show.users[0]
        userAvatar: show.mh_shows_id.show.users[0].mh_users_id.cover
      }

      console.log(showObj)
      console.log('avatar:',showObj.userAvatar)

      todayShowsForRadioStation.push(showObj);
    }
  })
  
  // const station = radiostations.find(station => station.id == radioId);

  // Render de radiopagina en geef de gegevens van het station door
  response.render('radio.liquid', { shows: todayShowsForRadioStation});
});


app.set('port', process.env.PORT || 8000)

// Start Express op, haal daarbij het zojuist ingestelde poortnummer op
app.listen(app.get('port'), function () {
  // Toon een bericht in de console en geef het poortnummer door
  console.log(`Application started on http://localhost:${app.get('port')}`)
})