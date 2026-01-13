# AetherLog - Full Stack Setup Guide

[![Build and Test](https://github.com/<OWNER>/<REPO>/actions/workflows/build-and-test.yml/badge.svg)](https://github.com/<OWNER>/<REPO>/actions/workflows/build-and-test.yml)
> **Note:** To activate the status badge above, replace `<OWNER>` and `<REPO>` with your GitHub username and repository name.

This guide provides instructions for setting up and running the complete AetherLog application on your local machine.

## Prerequisites

- [Node.js](https://nodejs.org/) & [npm](https://www.npmjs.com/)
- [Docker](https://www.docker.com/products/docker-desktop/) and Docker Compose
- A code editor like [Visual Studio Code](https://code.visualstudio.com/)
- API keys for AI, email, and SMS services.

---

## CI/CD with GitHub Actions

This project includes a professional Continuous Integration (CI) pipeline using GitHub Actions, located in `.github/workflows/build-and-test.yml`.

**What it does:**
- **Triggers Automatically:** The workflow runs on every `push` or `pull request` to the `main` branch.
- **Ensures Code Quality:** It performs the following automated checks to maintain code health:
    1.  Installs all frontend and backend dependencies.
    2.  Builds the backend TypeScript code to ensure there are no compilation or type-checking errors.

This automated process guarantees that the project is always in a buildable state, preventing bugs and demonstrating a mature, industry-standard development practice.

## Deployment Automation

This project is configured for automated deployment via GitHub integrations:

- **Frontend (Vercel)**: Pushes to the `main` branch automatically trigger a deployment on Vercel. The configuration is defined in `vercel.json`.
- **Backend (Render)**: Pushes to the `main` branch automatically trigger a deployment on Render. The configuration is defined in `render.yaml`.

To deploy updates, simply commit your changes and push to the `main` branch:

```bash
git add .
git commit -m "feat: your new feature"
git push origin main
```

---

## Configuration: The `.env` File

This is a critical first step for both setup options. All API keys and secrets are managed in a single `.env` file.

1.  Navigate into the `backend` folder.
2.  Create a new file named `.env`.
3.  Copy and paste the entire block below into the file, replacing the placeholders with your actual API keys and secrets.

    ```env
    # --- PostgreSQL Database Connection (for Hybrid Setup) ---
    # These values must match the 'environment' section for the 'db' service in docker-compose.yml
    POSTGRES_HOST=localhost
    POSTGRES_PORT=5434
    POSTGRES_USER=admin
    POSTGRES_PASSWORD=password123
    POSTGRES_DB=ailoganalyzer

    # --- Frontend URL (IMPORTANT for email links) ---
    # Set this to the URL where your frontend is running
    FRONTEND_URL="http://localhost:3000"

    # --- Secret Key for Sessions ---
    JWT_SECRET="some-really-strong-secret-for-jwt"

    # --- API Keys ---
    # You can provide one or both. If both are present, OpenAI will be prioritized.
    
    # Gemini API Key (Required for AI features if OpenAI key is not provided)
    API_KEY="YOUR_GEMINI_API_KEY_HERE"
    
    # OpenAI API Key (Prioritized for most AI features if present)
    OPENAI_API_KEY="YOUR_OPENAI_API_KEY_HERE"

    # Email (SendGrid) Configuration
    SENDGRID_API_KEY="YOUR_SENDGRID_API_KEY"
    EMAIL_FROM_ADDRESS="noreply@yourdomain.com"

    # SMS (Twilio) Configuration
    TWILIO_ACCOUNT_SID="YOUR_TWILIO_ACCOUNT_SID"
    TWILIO_AUTH_TOKEN="YOUR_TWILIO_AUTH_TOKEN"
    TWILIO_PHONE_NUMBER="+15551234567"
    ```

---

## Option 1: Hybrid Setup (Frontend/Backend Local, DB in Docker)

This setup is ideal for active development. You run the database in a Docker container and the frontend/backend servers directly on your machine for faster hot-reloading.

**You will need three terminal windows.**

**Terminal 1: Start the Database**
1.  From the project's **root directory**, run:
    ```bash
    docker-compose up db -d
    ```
    This command starts only the PostgreSQL database service in the background and will persist its data. You only need to do this once per session.

**Terminal 2: Run the Backend Server**
1.  Navigate into the `backend` directory:
    ```bash
    cd backend
    ```
2.  Install its dependencies (if you haven't already):
    ```bash
    npm install
    ```
3.  Start the development server:
    ```bash
    npm run dev
    ```
    The server will connect to the PostgreSQL database running in Docker. Leave this terminal running.

**Terminal 3: Run the Frontend Server**
1.  Navigate to the **root directory** of the project.
2.  Install dependencies (if you haven't already):
    ```bash
    npm install
    ```
3.  Start the frontend development server:
    ```bash
    npm run dev
    ```
    Your application will now open in your browser.

---

## Option 2: Full Docker Setup (Recommended for Simplicity)

This method runs the entire application stack (database, backend, frontend) inside Docker containers. It's the simplest way to get everything running with a single command.

**You only need one terminal window.**

1.  Make sure you have completed the `.env` file configuration step above.
2.  From the project's **root directory**, run:
    ```bash
    docker-compose up --build
    ```
    This will:
    - Build the Docker image for the backend service.
    - Start the PostgreSQL database container.
    - Start the backend container and connect it to the database.
    - **Note:** The frontend will be served directly by your local `npm run dev` command as specified in the prompt, connecting to the backend inside Docker.
    
3. In a separate terminal, start the frontend:
    ```bash
    npm install && npm run dev
    ```

Your application is now running. The frontend is accessible at `http://localhost:3000`, and it will communicate with the backend running inside Docker at `http://localhost:4000`.

---
## Production Considerations

### Improving Email Deliverability (Avoiding Spam)

If you find that emails sent from the application (like verification or password reset emails) are going to spam folders, it's almost certainly due to a lack of proper domain authentication. Email providers are very strict about unsolicited emails.

To ensure your emails are trusted and delivered to the inbox, you need to prove that you own your sending domain. This is done by adding `SPF` and `DKIM` records to your domain's DNS settings.

-   **SPF (Sender Policy Framework):** A DNS record that lists which IP addresses are authorized to send emails on behalf of your domain.
-   **DKIM (DomainKeys Identified Mail):** Provides a digital signature that verifies the sender and ensures the email content hasn't been tampered with.

**How to Fix This with SendGrid:**
SendGrid provides a straightforward guide to set this up. Follow their **Domain Authentication** process:

1.  Log in to your SendGrid account.
2.  Go to **Settings > Sender Authentication**.
3.  Follow the steps to authenticate your domain. SendGrid will provide you with several CNAME records.
4.  Add these CNAME records to your domain's DNS provider (e.g., GoDaddy, Cloudflare, Namecheap).
5.  Once the DNS changes propagate, click "Verify" in SendGrid.

Following these steps will significantly improve your sender reputation and email deliverability.