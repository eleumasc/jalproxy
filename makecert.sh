#!/bin/sh

mkdir -p certs && openssl req -x509 -new -nodes -keyout certs/mockttp-ca.key -sha256 -days 365 -out certs/mockttp-ca.pem -subj '/CN=Mockttp Testing CA - DO NOT TRUST'
