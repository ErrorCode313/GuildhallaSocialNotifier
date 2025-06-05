require('dotenv').config();
const APP_KEY = process.env.DB_APP_KEY
const BASE_URL = 'https://keyvalue.immanuel.co/api/KeyVal';


async function setValue(key, value) {
    // Convert value (JSON or other) to Base64
    const json = JSON.stringify(value);
    const base64 = Buffer.from(json).toString("base64");

    const url = `${BASE_URL}/UpdateValue/${APP_KEY}/${encodeURIComponent(key)}/${encodeURIComponent(base64)}`;

    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'text/plain'  // required to bypass JSON parsing on server
            }
            // no body needed
        });

        console.log(`[simpledb] Response status for key "${key}":`, res.status);
        if (!res.ok) {
            throw new Error(`Failed to set value: ${res.statusText}`);
        }
        return res.status === 200;
    } catch (err) {
        console.error(`[simpledb] setValue failed for key "${key}":`, err.message);
        return false;
    }
}

async function getValue(key) {
    const url = `${BASE_URL}/GetValue/${APP_KEY}/${encodeURIComponent(key)}`;

    try {
        const res = await fetch(url, { method: 'GET' });
        const data = await res.json();
        return data ?? null;
    } catch (err) {
        console.error(`[simpledb] getValue failed for key "${key}":`, err.message);
        return null;
    }
}

module.exports = {
    setValue,
    getValue
};
