const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');

process.env.PATH = `C:\\Users\\SAICHARAN\\AppData\\Local\\ms-playwright\\ffmpeg-1011;${process.env.PATH}`;

async function runDemo() {
  const outputDir = 'C:\\Users\\SAICHARAN\\.gemini\\antigravity-ide\\brain\\2f3e8833-66a4-420b-86ba-ec39cbd7b599';

  console.log('🎬 Launching Chromium for demo video recording...');
  const browser = await chromium.launch({
    args: ['--window-size=1280,800', '--disable-gpu']
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 750 },
    recordVideo: {
      dir: outputDir,
      size: { width: 1280, height: 750 }
    }
  });

  const page = await context.newPage();
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  try {
    // -------------------------------------------------------------
    // Step 1: Landing Page
    // -------------------------------------------------------------
    console.log('📌 Step 1: Landing Page');
    await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
    await wait(2500);

    // -------------------------------------------------------------
    // Step 2: Frontline Worker Login
    // -------------------------------------------------------------
    console.log('📌 Step 2: Frontline Worker Login');
    await page.click('button:has-text("Frontline Worker")');
    await page.waitForURL('**/login/frontline');
    await wait(1500);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/frontline/dashboard');
    console.log('✓ In Frontline Dashboard');
    await wait(2500);

    // -------------------------------------------------------------
    // Step 3: Register New Patient Referral on Citizen behalf
    // -------------------------------------------------------------
    console.log('📌 Step 3: Opening Register Patient Modal');
    await page.click('button:has-text("Register New Patient")');
    await wait(1500);

    console.log('Filling patient registration form...');
    await page.fill('#reg-name', 'Parvathamma B');
    await page.fill('#reg-age', '54');
    await page.selectOption('#reg-gender', 'Female');
    await page.fill('#reg-phone', '9845199881');
    await page.fill('#reg-village', 'Kamalapura Hamlet');
    await page.fill('#reg-district', 'Ballari');
    await page.fill('#reg-symptoms', 'Severe acute chest tightness and breathlessness');
    await page.fill('#reg-duration', '2 days');
    await page.selectOption('#reg-newsymptom', 'new');
    await page.fill('#reg-notes', 'Registered by ASHA frontline worker. Rural citizen with no smartphone.');
    await wait(2000);

    console.log('Submitting registration...');
    await page.click('#reg-submit-btn');
    await wait(3500); // wait for triage engine and QR generation

    console.log('✓ Patient referral registered! Showing QR Code and verification link');
    await wait(4000);

    // Close registration modal
    const doneBtn = await page.$('button:has-text("Done")');
    if (doneBtn) {
      await doneBtn.click();
    } else {
      const cancelBtn = await page.$('button:has-text("Cancel")');
      if (cancelBtn) await cancelBtn.click();
    }
    await wait(2000);

    // -------------------------------------------------------------
    // Step 4: Slot Allotment by Frontline Worker
    // -------------------------------------------------------------
    console.log('📌 Step 4: Slot Allotment by Frontline Worker');
    // Click allot slot button on the first case
    const allotBtns = await page.$$('button:has-text("Allot Slot")');
    if (allotBtns.length > 0) {
      await allotBtns[0].click();
      await wait(2000);

      // In modal, click the first available slot
      const availableSlot = await page.$('button:has-text("Available")');
      if (availableSlot) {
        await availableSlot.click();
        await wait(1500);
        console.log('Confirming slot allotment...');
        await page.click('button:has-text("Confirm & Allot Time Slot")');
        await wait(3000);
      }
    }

    // -------------------------------------------------------------
    // Step 5: Hospital Admin Services Addition
    // -------------------------------------------------------------
    console.log('📌 Step 5: Hospital Admin Services Addition');
    await page.goto('http://localhost:5173/login/hospital', { waitUntil: 'networkidle' });
    await wait(1500);
    // Click demo credentials
    const demoBtn = await page.$('button:has-text("Demo Credentials"), button:has-text("Fill Demo")');
    if (demoBtn) {
      await demoBtn.click();
      await wait(1000);
    } else {
      await page.fill('input[type="text"]', 'HF-KA-2024-0056');
      await page.fill('input[type="password"]', 'hospital123');
    }
    await page.click('button[type="submit"]');
    await page.waitForURL('**/hospital/dashboard');
    console.log('✓ In Hospital Dashboard');
    await wait(2500);

    // Click Add Service button
    console.log('Opening Add Facility Service Modal...');
    const addServiceBtn = await page.$('button:has-text("Add Facility Service")');
    if (addServiceBtn) {
      await addServiceBtn.click();
      await wait(1500);

      // Click preset Cardiologist
      const cardioBtn = await page.$('button:has-text("Cardiologist")');
      if (cardioBtn) {
        await cardioBtn.click();
        await wait(1000);
      }
      await page.click('button:has-text("Add to Hospital Services")');
      console.log('✓ Added service to hospital');
      await wait(3000);
    }

    // View appointments tab
    const apptTab = await page.$('button:has-text("Patient Appointments")');
    if (apptTab) {
      await apptTab.click();
      await wait(3000);
    }

    // -------------------------------------------------------------
    // Step 6: Patient Referral Status Tracking Page
    // -------------------------------------------------------------
    console.log('📌 Step 6: Patient Referral Tracking Page');
    await page.goto('http://localhost:5173/referral/TK-1012', { waitUntil: 'networkidle' });
    await wait(4000);

    // -------------------------------------------------------------
    // Step 7: District Admin Dashboard
    // -------------------------------------------------------------
    console.log('📌 Step 7: District Admin Dashboard');
    await page.goto('http://localhost:5173/login/district', { waitUntil: 'networkidle' });
    await wait(1500);
    const distDemoBtn = await page.$('button:has-text("Demo Credentials"), button:has-text("Fill Demo")');
    if (distDemoBtn) {
      await distDemoBtn.click();
      await wait(1000);
    } else {
      await page.fill('input[type="text"]', 'DA-KA-2024-001');
      await page.fill('input[type="password"]', 'district123');
    }
    await page.click('button[type="submit"]');
    await page.waitForURL('**/district/dashboard');
    console.log('✓ In District Dashboard');
    await wait(4000);

    console.log('🎉 Demo workflow completed successfully!');
  } catch (err) {
    console.error('Error during demo run:', err);
  } finally {
    const video = page.video();
    await context.close();
    await browser.close();

    if (video) {
      const videoPath = await video.path();
      console.log('🎥 Video recording saved at:', videoPath);
      // Copy or rename to varadhi_demo_video.webm in artifacts directory
      const destPath = path.join(outputDir, 'varadhi_demo_video.webm');
      fs.copyFileSync(videoPath, destPath);
      console.log('✅ Final demo video saved to:', destPath);
    }
  }
}

runDemo().catch(console.error);
