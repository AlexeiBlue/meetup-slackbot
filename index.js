var SlackBot = require("slackbots")
var request = require("request")
var util = require('util')
var dateFormat = require('dateformat')
var striptags = require('striptags');

var endpoint = "https://api.meetup.com/find/upcoming_events?order=time"

const meetupBotToken = process.env.MEETUP_BOT_TOKEN
const meetupAPIToken = process.env.MEETUP_API_TOKEN

// Create a bot
var bot = new SlackBot({
    token: meetupBotToken,
    name: "Meetup Bot"
})

bot.on("message", msg => {
    try {
        switch (msg.type) {
            case "message":
                // We only want to listen to direct messages that come from the user
                if (msg.channel[0] === "D" && msg.bot_id === undefined) {
                    getMeetups(postMessage, msg.user)
                }
                break
            case "desktop_notification":
                // We only want to respond when we are mentioned with, for now we respect one command
                if (msg.content.includes("@meetupbot show events")) {
                    getMeetups(postMessage, msg.channel)
                }
                break
        }
    } catch (error) {
        console.log(error)
    }
})

const postMessage = (message, output) => {
    bot.postMessage(output, message, { as_user: true })
}

const getMeetups = (callback, output) => {
    // Will break this up later into more configurable params
    var url = endpoint + "&topic_category=292&radius=2&end_date_range=" + getEndDate() + "&key=" + meetupAPIToken
    return request(url, (error, response) => {
        if (error) {
            console.log("Error: ", error)
        } else {
            var meetupJSON = JSON.parse(response.body)
            var eventLinks = meetupJSON.events.map( e => eventToMessage(e)).join('\n');
            return callback(eventLinks, output)
        }
    })
}

/**
 * Get the end date for the upcoming events.
 * 
 * Currently hardcoded for the next 7 days so something to configure later on.
 */
function getEndDate() {
    var date = new Date()
    date.setDate(date.getDate() + 7)
    var formattedDate = dateFormat(date, "yyyy-mm-dd'T'HH:MM:s");
    return formattedDate
}

/** 
 * Convert an event to a message format.
 * 
 * The message format is as follows:
 * Group Name [Event Name] (In Bold)
 * Event Address (Short version of the address in italics)
 * Event Date (Human Friendly format)
 * Description (Quoted in italics and truncated)
 * Event Link (If expansion occurs it will cause rich content to be added into slack automatically via the attachments functionality)
 * 
 * @param {JSON} event The Event to convert to a message
 */
function eventToMessage(event) {
    return util.format(
        '*%s [%s]*\n_%s_\n%s\n>_%s_\n%s\n',
        event.group.name, event.name,
        getEventAddress(event.venue),
        dateFormat(event.local_date + "T" + event.local_time),
        getEventDescription(event.description),
        event.link)
}

/**
 * Get a description for the event.
 * 
 * if it is undefined or empty a default message is returned,
 * otherwise if it's greater than 200 characters it is truncated and an ellipsis added,
 * otherwise it returns the description.
 * 
 * The description is stripped of HTML elements before being returned.
 * 
 * @param {string} description The description to handle
 */
function getEventDescription(description) {
    if (description === undefined || description === "") {
        return "No description"
    }

    if (description.length > 200) {
        return striptags(description).substring(0,200 - 3) + "..."
    }

    return striptags(description)
}

/**
 * Get the event address in a short format.
 *
 * If the venue isn't set it returns a default message, 
 * otherwise it returns the venue name, address line 1 and city as a single line.
 * 
 * @param {JSON} venue The venue as a JSON Object
 */
function getEventAddress(venue) {
    if (venue === undefined || venue === "") {
        return "No venue set, check with organisers for location"
    }

    return util.format("%s, %s, %s", venue.name, venue.address_1, venue.city)
}