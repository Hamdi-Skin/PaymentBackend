/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

const {onRequest} = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");



const express = require('express');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

const app = express();

/*
Creating a profile in CyberSource:
1. Payment Configuration
2. Secure Acceptance Settings
3. The profile should be activated before triggering the POST requests

Checking Transactions History of the profile:
Cybersource-> Transactions Management -> Secure Acceptance
*/
// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

const SECRET_KEY = 'a46132ff4cb5443d8af982d693f2ba5046311eefe5cb4777a1e54de4a55958cbb8ecece9672c4f7783e18edc24e4ddc5721e6fd24fb04291bc51d29fcdf826837e3e6092191542f9a4198ed9f109cad3a4db853424144ee48f7ec4a2958d369234882937259f4522bbe0fd4968d2cbdfe9083110bf714adda9c5de0282f83209';
const ACCESS_KEY = '92146b5fcf643bd0980b0847c1c44262';
const PROFILE_ID = 'B4359F51-8459-4211-9BA5-E800618FBBF3';
const PAYMENT_API_URL = 'https://testsecureacceptance.cybersource.com/pay';

function buildDataToSign(params) {
    const signedFields = params.signed_field_names.split(',');
    return signedFields.map(field => `${field}=${params[field]}`).join(',');
}

function sign(params) {
    const dataToSign = buildDataToSign(params);
    return crypto.createHmac('sha256', SECRET_KEY).update(dataToSign).digest('base64');
}

exports.processPayment = onRequest(async (req, res) => {
    try {
        const transaction_uuid = uuidv4();
        const signed_date_time = new Date().toISOString().replace(/\.\d+Z$/, 'Z');

        const mandatoryFields = [
            "locale", "amount", "currency", "bill_to_forename", "bill_to_surname", "bill_to_email",
            "bill_to_address_line1", "bill_to_address_city", "bill_to_address_postal_code",
            "bill_to_address_state", "bill_to_address_country", "payment_method", "card_type",
            "card_cvn", "card_number", "card_expiry_date"
        ];

        const missingFields = mandatoryFields.filter(field => !req.body[field]);
        if (missingFields.length > 0) {
            return res.status(400).json({ error: `Missing fields: ${missingFields.join(', ')}` });
        }

        const data = {
            access_key: ACCESS_KEY,
            profile_id: PROFILE_ID,
            transaction_uuid,
            signed_field_names: 'access_key,profile_id,transaction_uuid,signed_field_names,unsigned_field_names,signed_date_time,reference_number,locale,transaction_type,amount,currency',
            unsigned_field_names: 'bill_to_forename,bill_to_surname,bill_to_email,bill_to_address_line1,bill_to_address_city,bill_to_address_postal_code,bill_to_address_state,bill_to_address_country,payment_method,card_type,card_cvn,card_number,card_expiry_date',
            signed_date_time: signed_date_time,
            locale: req.body.locale,
            transaction_type: "sale",
            reference_number: Date.now(),
            amount: req.body.amount,
            currency: req.body.currency
        };

        // Add unsigned fields
        const unsignedFields = {
            bill_to_forename: req.body.bill_to_forename,
            bill_to_surname: req.body.bill_to_surname,
            bill_to_email: req.body.bill_to_email,
            bill_to_address_line1: req.body.bill_to_address_line1,
            bill_to_address_city: req.body.bill_to_address_city,
            bill_to_address_postal_code: req.body.bill_to_address_postal_code,
            bill_to_address_state: req.body.bill_to_address_state,
            bill_to_address_country: req.body.bill_to_address_country,
            payment_method: req.body.payment_method,
            card_type: req.body.card_type,
            card_cvn: req.body.card_cvn,
            card_number: req.body.card_number,
            card_expiry_date: req.body.card_expiry_date
        };

        const signature = sign(data);

        const fullPayload = {
            ...data,
            ...unsignedFields,
            signature: signature
        };

        const formData = objectToFormData(fullPayload);

        const response = await axios.post(PAYMENT_API_URL, formData, {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
          })

        res.status(200).json({ message: 'Payment submitted', apiResponse: response.data });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err });
    }
});

function objectToFormData(obj) {
    const formData = new FormData();
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        formData.append(key, obj[key]);
      }
    }
    return formData;
}