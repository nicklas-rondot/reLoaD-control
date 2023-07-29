npm run create-css
flask db migrate -m "add: created_at for all models"
flask db upgrade