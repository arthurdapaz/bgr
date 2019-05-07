#!/usr/bin/env node

var request = require('request')
var path = require('path')
var fs = require('fs')
const _progress = require('cli-progress')
var Jimp = require('jimp')
var argv = require('minimist')(process.argv.slice(2))

var appver = require("./package").version


const API_SIZE = 24
const configFile = (process.env.APPDATA || (process.platform == 'darwin' ? process.env.HOME + '/Library/Preferences' : process.env.HOME + "/.local/share")) + '/backgroundremover.config'


const c = {
  z: "\x1b[0m",
  _: "\x1b[4m",
  k: "\x1b[30m",
  r: "\x1b[31m",
  g: "\x1b[32m",
  y: "\x1b[33m"
}

const erro = c.r + 'Erro:' + c.z + ' '


humanFileSize = function (size) {
  var i = Math.floor(Math.log(size) / Math.log(1024))
  return (size / Math.pow(1024, i)).toFixed(2) * 1 + ['b', 'kb', 'mb', 'gb', 'tb'][i]
}


var sintaxe = `
  \x1b[44m\x1b[1m  Background Remover  \x1b[0m v${appver}${c.z}
    por Arthur da Paz

  No primeiro uso é
  obrigatório definir
  a chave da API:

     > ${c.y}rbg.exe -k [AKI_KEY_REMOVE.BG]${c.z}

  Opções:
     ${c.y}-v${c.z}	Exibe a versão atual
     ${c.y}-k${c.z}	Define a chave da API
     ${c.y}-K${c.z}	Exibe a chave da API atual
  
  Uso:
     > ${c.y}rbg[.exe]${c.z} ${c._}c:\\exemplo\\arquivo.jpg${c.z}

  Extensões permitidas:
     ${c.y}jpg${c.z} ou ${c.y}png${c.z}
`

var verstr = `Background Remover ${c.g}v${appver}${c.z} 2019.2.22, Arthur da Paz ${c._}ambrgo@gmail.com${c.z}`

var errstr = {
  'API_INDEFINIDA': `${erro}Informe a chave da API`,
  'API_SEM_CONFIG': `${erro}Chave da API ainda não foi configurada`,
  'API_TAMANHO_ER': `${erro}A chave deve ter ${API_SIZE} caracteres`,
  'API_NAO_STRING': `${erro}A API deve ser composta por letras e números`,
  'ENDERECO_INVAL': `${erro}Arquivo informado não existe`,
  'ARQUIVO_DEFEITUOSO': `${erro}Imagem escolhida está danificada e não pode ser processada`,
  'ERRO_IMAGEM_PROCESSADA': `${erro}Arquivo processado veio danificado. Provável falha na API do Remove.bg`
}

// ver a versao
if (argv.v) {
  console.log(verstr)
  process.exit()

}
// define a chave
else if (argv.k) {

  if (typeof argv.k !== 'string') {
    console.log(errstr.API_NAO_STRING)
    process.exit()
  } else if (argv.k.length > 0) {
    // salva a API no arquivo de configuracao
    try {
      fs.writeFileSync(configFile, argv.k)
      console.log('API salva com sucesso')

    } catch (error) {
      console.log('' + error)
    }

  } else {
    console.log(errstr.API_INDEFINIDA)

  }
  process.exit()

}

// ve se o arquivo da chave existe
else if (!fs.existsSync(configFile)) {
  console.log(errstr.API_SEM_CONFIG)
  process.exit()

} else {
  var API_KEY = fs.readFileSync(configFile, {
    encoding: 'utf8'
  })

  if (argv.K) {
    console.log(API_KEY)
    process.exit()
  }

  if (!API_KEY || API_KEY.length != API_SIZE) {
    console.log(errstr.API_TAMANHO_ER + `, mas a sua tem ${c.r}${API_KEY.length}${c.z}`)
    process.exit()
  }

}

// verifica sintaxe correta
if (argv._.length == 0) {
  console.log(sintaxe)
  process.exit()
}


// inicia o processamento após todas as validações
var imagePath = argv._[0]

if (!fs.existsSync(imagePath)) {
  console.log(errstr.ENDERECO_INVAL)
  process.exit()
}

var imageName = path.parse(imagePath).name
var imageFolder = path.parse(imagePath).dir
var imageProcessed = imageFolder + '/' + imageName + '_no-bg.png'



var image = new Jimp(imagePath, function (err, image) {

  if (err) {
    console.log(errstr.ARQUIVO_DEFEITUOSO)
    process.exit()
  }


  var originalW = image.bitmap.width
  var originalH = image.bitmap.height

  console.log('\n ' + c.y + 'Enviando ' + c.z + path.parse(imagePath).base + ' \u25B2 ' + c.y + originalW + c.z + 'x' + c.y + originalH + c.z + '\n')

  // preparar barra de progresso
  let size = fs.lstatSync(imagePath).size
  let bytes = 0

  const pbar = new _progress.Bar({
    format: ' ' + humanFileSize(size) + ' {bar} ' + c.g + '{percentage}%' + c.z + ' | {eta}s | {current}',
    barsize: 35,
    stopOnComplete: true,
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591'
  })

  pbar.start(size, 0)


  request.post({
    url: 'https://api.remove.bg/v1.0/removebg',
    formData: {
      image_file: fs.createReadStream(imagePath).on('data', (chunk) => {
        bytes += chunk.length
        pbar.update(bytes, {
          current: humanFileSize(bytes)
        })
      }),
      size: 'regular',
    },
    headers: {
      'X-Api-Key': API_KEY
    },
    encoding: null
  }, function (error, response, body) {
    if (error)
      return console.log('\n' + erro + error)

    if (response.statusCode != 200) {

      console.log('\n' + erro + '' + response.statusCode + ' ')

      var response = JSON.parse(body.toString('utf8'))

      response.errors.forEach(element => {
        console.log(element.title)
      })

      process.exit()
    }

    try {
      fs.writeFileSync(imageProcessed, body)

      Jimp.read(imageProcessed, (err, img) => {

        if (err) {
          console.log(errstr.ERRO_IMAGEM_PROCESSADA)
          process.exit()
        }

        console.log('\n ' + imageFolder + '\\' + c.g + path.parse(imageProcessed).base + c.z + ' \u25B2 ' + c.y + img.bitmap.width + c.z + 'x' + c.y + img.bitmap.height + c.z + '\n')
        
        img
          .resize(originalW, originalH, Jimp.RESIZE_BEZIER)
          .write(imageProcessed)


      })

    } catch (error) {
      console.log(erro + error)
    }

  })

})
