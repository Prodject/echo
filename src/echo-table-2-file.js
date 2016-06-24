'use strict'

// Load our modules
var fs = require('fs')
var path = require('path')
var tabletojson = require('tabletojson')
var json2csv = require('json2csv')
var cheerio = require('cheerio')
var colors = require('colors')
var request = require('request')

// Set defaults
var defaults = {
  'path': 'process',
  'url': 'http://www.coolgithubprojects.com',
  'dest': 'output',
  'format': 'csv',
  'mode': null
}

// Set theme for output
colors.setTheme({
  info: 'green',
  warn: 'yellow',
  debug: 'blue',
  error: 'red',
  data: 'grey'
})

// MARK : Main functions.
var _convert = (inputs) => {
  // Validate our inputs
  var validate = new Promise((resolve, reject) => {
    _validateArguments(inputs, (options) => {
      if (options) {
        resolve(options)
      } else {
        reject('Unable to validate arguments')
      }
    })
  })

  // Validate paths
  validate.then((options) => {
    var process = new Promise((resolve, reject) => { // Process
      _validatePaths(options, (status) => {
        if (status) {
          resolve(options)
        } else {
          reject('Unable to validate paths.')
        }
      })
    })

    process.then((options) => { // Process our data and save it
      _processData(options, (status) => {
        console.log((status).info)
      })
    },
    (error) => {
      let err = 'Something went wrong during processing : ' + error
      console.log((err).error)
    })
  },
  (error) => {
    let err = 'Something went wrong during validation : ' + error
    console.log((err).error)
  })
}

// MARK Exported methods
var convert = function (path, dest, format, tableId) {
  // call internal convert
  let inputs = {
    'mode': 'file',
    'path': path,
    'dest': dest,
    'format': format,
    'tableId': tableId
  }
  _convert(inputs)
}

var convertUrl = function (url, dest, format, tableId) {
  // call internal convert
  let inputs = {
    'mode': 'url',
    'url': url,
    'dest': dest,
    'format': format,
    'tableId': tableId
  }
  _convert(inputs)
}

exports.convert = convert
exports.convertUrl = convertUrl

// MARK : Supportive functions
function _validateArguments (options, cb) {
  // Validate and prepare our arguments

  // If path is not given kick in defaults
  if (!options.path && options.mode === 'file') {
    options.path = path.join(process.cwd(), defaults.path)
    console.log(('Warning: No path specified. Setting it to ' + options.path).warn)
  }

  // Do the same for dest
  if (!options.dest) {
    options.dest = path.join(process.cwd(), defaults.dest)
    console.log(('Warning: No destination specified. Setting it to ' + options.dest).warn)
  }

  // Set url
  if (!options.url && options.mode === 'url') {
    options.url = defaults.url
    console.log(('Warning: No destination specified. Setting it to ' + options.dest).warn)
  }

  // Set format type
  options.format = (!options.format) ? defaults.format : options.format
  cb(options)
}

function _validatePaths (options, cb) {
  fs.readdir(process.cwd(), function (err, files) {
    if (err) throw err

    // Check if path exists if calling from convert
    if (options.path) {
      // Verify path
      var pathIsThere = files.filter(function (obj) {
        return obj === options.path
      })

      if (pathIsThere.length === 0) {
        var errMessage = 'Path to process HTML files not there. Path is set to ' + options.path
        console.log((errMessage).error)
        throw errMessage
      }
    }

    // Verify dest
    var destIsThere = files.filter(function (obj) {
      return obj === options.dest
    })

    // If not found let us create
    if (destIsThere.length === 0) {
      console.log('Creating destination folder'.warn)
      fs.mkdirSync(options.dest)
      cb('done')
    } else {
      cb('done')
    }
  })
}

function _processData (options, cb) {
  if (options.mode === 'file') {
    // Parse through each and find html file
    fs.readdir(options.path, function (err, files) {
      if (err) throw err

      var htmlfiles = files.filter(function (obj) {
        return (obj.match('.html') !== null)
      })

      if (htmlfiles.length === 0) {
        console.log('No HTML files in folder.'.error)
      }
      // Process each HTML
      htmlfiles.forEach(function (file) {
        var info = 'Working on ' + file
        var filePath = path.join(options.path, file)
        console.log((info).data)

        // Read file content
        fs.readFile(filePath, (err, html) => {
          if (err) throw err

          _prepareHTML(html, options)
        })
      })
    })
  } else {
    request(options.url, function (error, response, html) {
      var info = 'HTML received.'
      console.log((info).data)

      if (!error && response.statusCode === 200) {
        _prepareHTML(html, options)
      }
    })
  }
}

function _prepareHTML (html, options) {
  var tables = ''
  var tableIds = []
  var $ = cheerio.load(html)

  // Check if we should filter down based on ID.
  var filter = (typeof options.tableId !== 'undefined') ? '#' + options.tableId : 'table'

  // Try to grab each table using cheerio to get an ID for the filename. Filter HTML down to wanted tables.
  $(filter).each(function (i, element) {
    tableIds[i] = $(this).attr('id')
    tables += $(this).parent().html()
  })

  var tablesAsJson = tabletojson.convert(tables)

  var status = (tablesAsJson.length === 1) ? 'Found 1 table.' : ('Found ' + tablesAsJson.length + ' tables.')
  console.log((status).data)

  _writeData(tablesAsJson, tableIds, options)
}

function _writeData (tablesAsJson, tableIds, options) {
  // File to write
  tablesAsJson.forEach((table, index, arr) => {
    var filePath = path.join(process.cwd(), options.dest) // Reset

    if (options.format === 'csv') {
      json2csv({
        data: table
      }, function (err, csv) {
        if (err) throw err

        var fileName = tableIds[index] + '.csv'
        filePath = path.join(filePath, fileName)

        fs.writeFile(filePath, csv, (err) => {
          if (err) throw err

          var status = 'Successfully saved ' + filePath
          console.log((status).info)
        })
      })
    } else {
      var fileName = tableIds[index] + '.json'
      filePath = path.join(filePath, fileName)

      fs.writeFile(filePath, JSON.stringify(table), (err) => {
        if (err) throw err

        var status = 'Successfully saved ' + filePath
        console.log((status).info)
      })
    }
  })
}
