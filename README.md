# jalproxy

Reverse proxy for on-the-fly instrumentation with jalangi2

## Requirements

 - node v14.0.0+

## Setup

 - Copy the file ".env.example", rename it to ".env", open it and set `JALANGI_HOME` to the root folder of jalangi2
  - Open a terminal and run the command `./makecert.sh`
  - Install the certificate "certs/mockttp-ca.pem" and set it as trusted CA in your system or browser (NOTE: we highly recommend to use Firefox)

## Run

 - Open a terminal and run the command `node index.js`
