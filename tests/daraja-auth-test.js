
import { getDarajaAccessToken } from "../src/modules/payments/daraja.service.js";

try {
  console.log("Requesting Daraja access token...");

  const token = await getDarajaAccessToken();

  console.log("Daraja authentication successful.");
  console.log("Access token received:", Boolean(token));
} catch (error) {
  console.error("Daraja authentication failed:");
  console.error(error.message);

  process.exitCode = 1;
}
