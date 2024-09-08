# Initialize DB
```console
flask db init
flask db migrate -m "<message> (optional)"
flask db upgrade
```

# How to run (locally)
```console
openssl req -x509 -newkey rsa:4096 -nodes -out cert.pem -keyout key.pem -days 365
flask run --cert cert.pem --key key.pem
```