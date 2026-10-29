# Студенттердің үлгерімін есептеу жүйесі

Node.js + Express (бэкенд) және HTML/CSS/JS (фронтенд).

## Іске қосу
    npm install
    npm start
Браузерде ашу: http://localhost:3000

## Мұғалім кіруі
Әдепкі құпия сөз: `admin123`. Өзгерту:
- Windows (PowerShell): `$env:ADMIN_PASSWORD="мойпароль"; npm start`
- Linux/macOS: `ADMIN_PASSWORD=мойпароль npm start`

## CSV импорт форматы
Бірінші жол тақырып: `Студент;Топ;Математика;Информатика;...`
Пән бағандарының аттары жүйедегі пәндермен бірдей болуы керек.
Экспортталған файлды тікелей импорттауға болады.

## API
- GET /api/students?search=&group=&sort=  | GET /api/students/:id
- POST/PUT/DELETE /api/students            (мұғалім)
- GET /api/subjects | POST/DELETE /api/subjects  (мұғалім)
- POST /api/import                          (мұғалім)
- GET /api/stats?group=
- GET /api/chat/stream (SSE) | POST /api/chat | DELETE /api/chat/:id (мұғалім)
- POST /api/login | POST /api/logout

Деректер `data/db.json` (оқу деректері) және `data/chat.json` (чат тарихы, соңғы 200 хабарлама) файлдарында сақталады.

## Интернетке шығару (Render)
1. Жобаны GitHub-қа жүктеңіз.
2. Render → New → Blueprint → репозиторийді таңдаңыз (`render.yaml` бәрін өзі баптайды).
3. `ADMIN_PASSWORD` енгізіңіз. Нақты студент деректері болса, `PRIVATE_VIEW` мәнін `1` қылыңыз.
4. Settings → Custom Domains арқылы өз доменіңізді қосыңыз (CNAME жазбасы).

Қосымша айнымалылар: `DATA_DIR` (деректер папкасы), `PRIVATE_VIEW=1` (бағаларды тек мұғалім көреді).
Production-та `ADMIN_PASSWORD` болмаса, сервер іске қосылмайды. Кіруге 8 қате әрекеттен соң 15 минут блок қойылады.

## Нақты деректер
`seed/db.json` ішінде 5 топтың (АИУ-22, ВТИПО-22, ИС-22, ХТ-22, ЭЭ-22) 12 пән бойынша бағалары бар. Деректер базасы бос болғанда сервер оны бір рет жүктейді.
Студенттердің аты-жөні бар, сондықтан GitHub репозиторийі **жабық (Private)** болуы керек. `PRIVATE_VIEW=1` қосулы, бағаларды тек мұғалім көреді.
