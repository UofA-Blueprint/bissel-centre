const https = require("https");
const http = require("http");

async function setAdminPrivileges(email) {
  const data = JSON.stringify({ email });

  const options = {
    hostname: "localhost",
    port: 3000,
    path: "/api/set-admin",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": data.length,
    },
  };

  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let responseData = "";

      res.on("data", (chunk) => {
        responseData += chunk;
      });

      res.on("end", () => {
        try {
          const result = JSON.parse(responseData);
          if (res.statusCode === 200) {
            console.log("✅ Success:", result.message);
            console.log("User UID:", result.uid);
            console.log(
              "Admin Status:",
              result.isAdmin ? "✅ Admin" : "❌ Not Admin"
            );
            resolve(result);
          } else {
            console.error("❌ Error:", result.error);
            console.error("Details:", result.details);
            reject(new Error(result.error));
          }
        } catch (error) {
          console.error("❌ Failed to parse response:", error.message);
          reject(error);
        }
      });
    });

    req.on("error", (error) => {
      console.error("❌ Request failed:", error.message);
      reject(error);
    });

    req.write(data);
    req.end();
  });
}

// Set admin for audrey@gmail.com
async function main() {
  try {
    console.log("🚀 Setting admin privileges for audrey@gmail.com...");
    console.log(
      "Make sure your Next.js development server is running on port 3000"
    );
    console.log("");

    await setAdminPrivileges("audrey@gmail.com");

    console.log("");
    console.log("🎉 Script completed successfully!");
    console.log(
      "You can now login with audrey@gmail.com and access admin features."
    );
  } catch (error) {
    console.error("💥 Script failed:", error.message);
    console.log("");
    console.log("Troubleshooting:");
    console.log("1. Make sure your Next.js server is running (npm run dev)");
    console.log("2. Check that the server is running on port 3000");
    console.log("3. Verify that audrey@gmail.com exists in Firebase Auth");
    process.exit(1);
  }
}

main();
