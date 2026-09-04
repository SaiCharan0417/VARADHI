const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');

process.env.PATH = `C:\\Users\\SAICHARAN\\AppData\\Local\\ms-playwright\\ffmpeg-1011;${process.env.PATH}`;

async function recordFullDemo() {
  const outputDir = 'C:\\Users\\SAICHARAN\\.gemini\\antigravity-ide\\brain\\2f3e8833-66a4-420b-86ba-ec39cbd7b599';

  console.log('🎬 Starting Full End-to-End Demo Recording with Visible Mouse Pointer...');
  const browser = await chromium.launch({
    args: ['--window-size=1280,820', '--disable-gpu']
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 760 },
    recordVideo: {
      dir: outputDir,
      size: { width: 1280, height: 760 }
    }
  });

  const page = await context.newPage();

  // Inject visible custom mouse pointer into every page/navigation
  await page.addInitScript(() => {
    window.addEventListener('DOMContentLoaded', () => {
      let pointer = document.getElementById('varadhi-mouse-pointer');
      if (!pointer) {
        pointer = document.createElement('div');
        pointer.id = 'varadhi-mouse-pointer';
        pointer.style.width = '24px';
        pointer.style.height = '24px';
        pointer.style.borderRadius = '50%';
        pointer.style.background = 'radial-gradient(circle, #ff3333 40%, rgba(255,255,255,0.9) 70%, rgba(255,50,50,0.4) 100%)';
        pointer.style.border = '2.5px solid #ffffff';
        pointer.style.boxShadow = '0 0 14px 4px rgba(255, 30, 30, 0.95)';
        pointer.style.position = 'fixed';
        pointer.style.top = '0px';
        pointer.style.left = '0px';
        pointer.style.pointerEvents = 'none';
        pointer.style.zIndex = '999999';
        pointer.style.transform = 'translate(-50px, -50px)';
        pointer.style.transition = 'transform 0.04s ease-out, background 0.12s, width 0.12s, height 0.12s';
        document.body.appendChild(pointer);

        window.addEventListener('mousemove', (e) => {
          pointer.style.transform = `translate(${e.clientX - 12}px, ${e.clientY - 12}px)`;
        });

        window.addEventListener('mousedown', () => {
          pointer.style.background = 'radial-gradient(circle, #ffea00 50%, #ffffff 80%, rgba(255,230,0,0.6) 100%)';
          pointer.style.boxShadow = '0 0 18px 6px rgba(255, 230, 0, 1)';
        });

        window.addEventListener('mouseup', () => {
          pointer.style.background = 'radial-gradient(circle, #ff3333 40%, rgba(255,255,255,0.9) 70%, rgba(255,50,50,0.4) 100%)';
          pointer.style.boxShadow = '0 0 14px 4px rgba(255, 30, 30, 0.95)';
        });
      }
    });
  });

  let currentMouseX = 640;
  let currentMouseY = 380;

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  async function smoothMouseMove(targetX, targetY, steps = 14) {
    const startX = currentMouseX;
    const startY = currentMouseY;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      const x = Math.round(startX + (targetX - startX) * ease);
      const y = Math.round(startY + (targetY - startY) * ease);
      await page.mouse.move(x, y);
      await wait(18);
    }
    currentMouseX = targetX;
    currentMouseY = targetY;
  }

  async function smoothClick(selector, timeout = 7000) {
    await page.waitForSelector(selector, { state: 'visible', timeout });
    const el = await page.$(selector);
    if (!el) throw new Error(`Element not found: ${selector}`);
    const box = await el.boundingBox();
    if (!box) {
      await el.click();
      return;
    }
    const targetX = Math.round(box.x + box.width / 2);
    const targetY = Math.round(box.y + box.height / 2);
    await smoothMouseMove(targetX, targetY);
    await wait(150);
    await page.mouse.down();
    await wait(120);
    await page.mouse.up();
    await wait(200);
    await el.click().catch(() => {});
  }

  async function smoothType(selector, text) {
    await smoothClick(selector);
    await wait(120);
    await page.fill(selector, '');
    for (const char of text) {
      await page.type(selector, char, { delay: 20 + Math.random() * 20 });
    }
    await wait(200);
  }

  try {
    // =========================================================================
    // STEP 1: Patient Sign In & Registering Referral
    // =========================================================================
    console.log('📌 STEP 1: Landing Page -> Patient Login');
    await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
    await wait(2000);

    console.log('Moving mouse to Patient role button...');
    await smoothClick('button:has-text("Patient")');
    await page.waitForURL('**/login/patient');
    await wait(1800);

    console.log('Clicking Demo Patient Credentials (Sunita Devi)...');
    await smoothClick('button:has-text("Use Demo Patient")');
    await wait(1200);

    console.log('Clicking Sign In...');
    await smoothClick('button[type="submit"]');
    await page.waitForURL('**/patient/dashboard');
    console.log('✓ Successfully in Patient Dashboard');
    await wait(2500);

    // Register a new referral case
    console.log('Opening Register Patient Case Assessment...');
    const regCaseBtn = await page.$('button:has-text("Register Patient Case")');
    if (regCaseBtn) {
      await smoothClick('button:has-text("Register Patient Case")');
    } else {
      await smoothClick('button:has-text("Report New Symptoms")');
    }
    await wait(1500);

    // If active referral confirmation dialog appears, click Close Previous & Evaluate New
    const confirmCloseBtn = await page.$('button:has-text("Close Previous & Evaluate New")');
    if (confirmCloseBtn) {
      console.log('Confirming closing previous case to evaluate new symptoms...');
      await smoothClick('button:has-text("Close Previous & Evaluate New")');
      await wait(2000);
    }

    console.log('Filling symptom assessment form...');
    await smoothType('textarea', 'Acute severe chest pain, shortness of breath and heart palpitations');
    await wait(1000);

    // Select pain level 8
    console.log('Selecting Pain Level 8...');
    const painButtons = await page.$$('.pain-btn');
    if (painButtons.length >= 8) {
      const box = await painButtons[7].boundingBox();
      if (box) {
        await smoothMouseMove(box.x + box.width / 2, box.y + box.height / 2);
        await painButtons[7].click();
      }
    }
    await wait(1500);

    console.log('Submitting for AI Triage & Token...');
    await smoothClick('button[type="submit"]');
    await wait(3500); // wait for AI triage engine

    console.log('✓ AI Triage Result Modal displayed with Token Number!');
    await wait(4000);

    console.log('Clicking Continue to Care Dashboard...');
    await smoothClick('button:has-text("Continue to Care Dashboard")');
    await wait(3500);

    // View the active care journey
    console.log('Inspecting active care journey...');
    await smoothMouseMove(640, 320);
    await wait(2500);

    // Logout from patient
    console.log('Logging out of patient account...');
    await smoothClick('button[title="Sign Out"]');
    await wait(2000);

    // =========================================================================
    // STEP 2: Hospital Admin Adding Services
    // =========================================================================
    console.log('📌 STEP 2: Hospital Admin Login & Service Addition');
    await page.goto('http://localhost:5173/login/hospital', { waitUntil: 'networkidle' });
    await wait(2000);

    console.log('Clicking Demo Credentials...');
    await smoothClick('button:has-text("Demo Credentials")');
    await wait(1200);

    console.log('Signing in as Hospital Admin...');
    await smoothClick('button[type="submit"]');
    await page.waitForURL('**/hospital/dashboard');
    console.log('✓ In Hospital Admin Dashboard');
    await wait(3000);

    console.log('Opening Add Facility Service Modal...');
    await smoothClick('button:has-text("+ Add Facility Service")');
    await wait(2000);

    console.log('Quick Selecting Specialist: Cardiologist...');
    await smoothClick('button:has-text("Cardiologist")');
    await wait(1500);

    console.log('Submitting new service to hospital readiness registry...');
    await smoothClick('button:has-text("Add to Hospital Services")');
    await wait(3500);
    console.log('✓ Added Cardiologist service to District Hospital!');

    // Show live hospital readiness & appointments
    console.log('Viewing hospital appointments tab...');
    const apptTab = await page.$('button:has-text("Patient Appointments")');
    if (apptTab) {
      await smoothClick('button:has-text("Patient Appointments")');
      await wait(3000);
    }

    // Sign out from Hospital Admin
    console.log('Signing out of Hospital Admin...');
    await smoothClick('button[title="Sign Out"]');
    await wait(2000);

    // =========================================================================
    // STEP 3: Frontline Worker Login, Inspecting Services & Slot Allotment
    // =========================================================================
    console.log('📌 STEP 3: Frontline Worker Login & Live Readiness Inspection');
    await page.goto('http://localhost:5173/login/frontline', { waitUntil: 'networkidle' });
    await wait(2000);

    console.log('Signing in as Frontline Worker...');
    await smoothClick('button[type="submit"]');
    await page.waitForURL('**/frontline/dashboard');
    console.log('✓ In Frontline Dashboard');
    await wait(3000);

    console.log('Switching to Facility Live Readiness tab...');
    await smoothClick('button:has-text("Facility Live Readiness")');
    await wait(4000); // show available doctors, beds, and new cardiologist service

    console.log('Switching back to Cases view to allot slot for patient...');
    await smoothClick('button:has-text("Triaged Cases")');
    await wait(2500);

    console.log('Clicking Allot Time Slot for patient referral...');
    const allotBtns = await page.$$('button:has-text("Allot Time Slot")');
    if (allotBtns.length > 0) {
      const box = await allotBtns[0].boundingBox();
      if (box) {
        await smoothMouseMove(box.x + box.width / 2, box.y + box.height / 2);
        await allotBtns[0].click();
      }
      await wait(2500);

      console.log('Selecting available 20-minute slot in hospital...');
      const availSlot = await page.$('button:has-text("Available")');
      if (availSlot) {
        const sBox = await availSlot.boundingBox();
        if (sBox) {
          await smoothMouseMove(sBox.x + sBox.width / 2, sBox.y + sBox.height / 2);
          await availSlot.click();
        }
        await wait(1800);

        console.log('Confirming Slot Allotment & dispatching SMS...');
        await smoothClick('button:has-text("Confirm & Allot Time Slot")');
        await wait(3500);
      }
    }

    // =========================================================================
    // STEP 4: Frontline Worker Adding Patient Referral on Citizen Behalf & QR
    // =========================================================================
    console.log('📌 STEP 4: Registering Rural Citizen Referral & Generating QR');
    await smoothClick('button:has-text("Register New Patient")');
    await wait(2000);

    console.log('Filling rural citizen referral form...');
    await smoothType('#reg-name', 'Devamma Hampi');
    await smoothType('#reg-age', '62');
    await smoothType('#reg-phone', '9845177889');
    await smoothType('#reg-village', 'Kamalapura Hamlet');
    await smoothType('#reg-symptoms', 'Severe chest tightness radiating to left arm');
    await smoothType('#reg-duration', '4 days');
    await smoothType('#reg-notes', 'Rural citizen without smartphone. Case registered directly by ASHA frontline worker.');
    await wait(2000);

    console.log('Registering referral & generating QR code...');
    await smoothClick('#reg-submit-btn');
    await wait(4000); // wait for AI triage and QR code generation

    console.log('✓ Referral created! High-contrast QR Code & Verification link displayed!');
    await wait(5000); // pause to clearly showcase QR Code and verification URL

    // Close registration modal
    await smoothClick('button:has-text("Done")');
    await wait(2000);

    // Frontline worker signs out
    console.log('Frontline worker signing out...');
    await smoothClick('button[title="Back to Home"]');
    await wait(2000);

    // =========================================================================
    // STEP 5: Log back into Patient Account to reflect updated referral status!
    // =========================================================================
    console.log('📌 STEP 5: Re-login to Patient Account to verify updated status');
    await page.goto('http://localhost:5173/login/patient', { waitUntil: 'networkidle' });
    await wait(2000);

    console.log('Selecting Demo Patient Sunita Devi...');
    await smoothClick('button:has-text("Use Demo Patient")');
    await wait(1200);

    console.log('Signing in...');
    await smoothClick('button[type="submit"]');
    await page.waitForURL('**/patient/dashboard');
    console.log('✓ Back in Patient Dashboard!');
    await wait(3000);

    // Inspect live allotted slot card and journey milestones
    console.log('Inspecting live referral status and allotted appointment...');
    await smoothMouseMove(640, 340);
    await wait(3000);
    await smoothMouseMove(640, 500);
    await wait(3500);

    // Navigate to direct public tracking page URL to showcase QR destination
    console.log('Showing public referral tracking verification page...');
    await page.goto('http://localhost:5173/referral/TK-1012', { waitUntil: 'networkidle' });
    await wait(4000);
    await smoothMouseMove(640, 360);
    await wait(3500);

    console.log('🎉 Full End-to-End Demo successfully completed!');
  } catch (err) {
    console.error('Error in full demo execution:', err);
  } finally {
    const video = page.video();
    await context.close();
    await browser.close();

    if (video) {
      const videoPath = await video.path();
      console.log('🎥 Video recording saved at:', videoPath);
      const destArtifactPath = path.join(outputDir, 'varadhi_full_demo.webm');
      const destProjectPath = 'd:\\sih\\varadhi\\varadhi_full_demo.webm';
      fs.copyFileSync(videoPath, destArtifactPath);
      fs.copyFileSync(videoPath, destProjectPath);
      console.log('✅ Final demo video saved to:');
      console.log('   Artifacts:', destArtifactPath);
      console.log('   Project:', destProjectPath);
    }
  }
}

recordFullDemo().catch(console.error);
