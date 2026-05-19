# voice demo

Next.js voice demo for Cicada Speech, ready for Vercel deployment.

## Included bots

- TPV (Chinese)
- TPV
- DJI

## Environment variable

Set this in Vercel Project Settings -> Environment Variables:

```bash
RETELL_API_KEY=your_secret_api_key
```

## Local development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Deploy to Vercel

1. Push this folder to a Git repository.
2. Import the repository into Vercel.
3. Add `RETELL_API_KEY` in the Vercel project environment variables.
4. Redeploy.

Vercel will generate a public URL such as `https://your-project-name.vercel.app`.

## Architecture

- `app/page.tsx`: landing page
- `app/api/config/route.ts`: exposes bot config to the client
- `app/api/create-web-call/route.ts`: server-side voice session creation
- `components/voice-demo.tsx`: browser voice client
