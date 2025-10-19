import twilio from 'twilio';

/**
 * Configure Twilio phone number webhook
 */
export async function configureTwilioWebhook(
  accountSid: string,
  authToken: string,
  phoneNumber: string,
  webhookUrl: string
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log(`🔧 Configuring Twilio webhook for ${phoneNumber}...`);
    
    const client = twilio(accountSid, authToken);
    
    // List incoming phone numbers to find the one matching our phone number
    const incomingPhoneNumbers = await client.incomingPhoneNumbers.list({
      phoneNumber: phoneNumber,
      limit: 1,
    });
    
    if (incomingPhoneNumbers.length === 0) {
      throw new Error('Phone number not found in Twilio account');
    }
    
    const phoneNumberSid = incomingPhoneNumbers[0].sid;
    
    // Update the phone number's voice webhook
    const response = await client.incomingPhoneNumbers(phoneNumberSid).update({
      voiceUrl: webhookUrl,
      voiceMethod: 'POST',
    });

    console.log('Twilio webhook configuration response:', response);

    console.log(`✅ Configured webhook for ${phoneNumber}`);
    
    return { success: true };
  } catch (error) {
    console.error('❌ Error configuring Twilio webhook:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Configure Twilio trunk for agent-initiated transfers
 * 
 * CRITICAL: For SIP REFER transfers to work, the SIP connection MUST be through a trunk
 * with transfer-mode: enable-all. Phone numbers MUST be associated with this trunk.
 * 
 * However, trunk-associated numbers can't use voiceUrl webhooks - they need origination URLs.
 * Since we want our /api/calls/incoming logic, we configure BOTH:
 * 1. Phone number voiceUrl → /api/calls/incoming (for business logic)
 * 2. Phone number trunkSid → trunk with enable-all (for transfer permissions)
 * 
 * Twilio will use voiceUrl if set, trunk origination only as fallback.
 */
export async function configureTwilioTrunkTransfers(
  accountSid: string,
  authToken: string,
  phoneNumber: string
): Promise<{ success: boolean; trunkSid?: string; error?: string }> {
  try {
    console.log(`🔧 Configuring Twilio trunk for SIP REFER transfers...`);
    
    const client = twilio(accountSid, authToken);
    
    // Find the phone number
    const incomingPhoneNumbers = await client.incomingPhoneNumbers.list({
      phoneNumber: phoneNumber,
      limit: 1,
    });
    
    if (incomingPhoneNumbers.length === 0) {
      throw new Error('Phone number not found in Twilio account');
    }
    
    const phoneNumberRecord = incomingPhoneNumbers[0];
    
    // Find or create trunk with transfer capability
    let trunkSid: string;
    const trunks = await client.trunking.v1.trunks.list({ limit: 1 });
    
    if (trunks.length > 0) {
      trunkSid = trunks[0].sid;
      
      await client.trunking.v1.trunks(trunkSid).originationUrls.create({
        sipUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/calls/incoming`,
        priority: 1,
        weight: 1,
        enabled: true,
        friendlyName: 'Voiceify Transfer Origination URL',
      })
      await client.trunking.v1.trunks(trunkSid).update({
        'disasterRecoveryUrl': `${process.env.NEXT_PUBLIC_APP_URL}/api/calls/incoming`,
      })
      console.log(`Found existing trunk: ${trunkSid}`);
    } else {
      // Create a new trunk for transfers
      console.log('Creating new Twilio trunk for transfers...');
      const newTrunk = await client.trunking.v1.trunks.create({
        friendlyName: 'Voiceify Transfer Trunk',
        transferMode: 'enable-all', // Critical: enables SIP REFER transfers
        transferCallerId: 'from-transferee',
      });
      trunkSid = newTrunk.sid;
      console.log(`Created new trunk: ${trunkSid}`);
    }
    
    // Update trunk with transfer settings
    await client.trunking.v1.trunks(trunkSid).update({
      transferMode: 'enable-all',
      transferCallerId: 'from-transferee',
    });
    
    console.log('✅ Configured trunk with transfer mode: enable-all');
    
    // Associate phone number with trunk (required for SIP REFER permissions)
    if (phoneNumberRecord.trunkSid !== trunkSid) {
      console.log(`Associating phone number with trunk ${trunkSid}...`);
      
      await client.incomingPhoneNumbers(phoneNumberRecord.sid).update({
        trunkSid: trunkSid,
      });
      
      console.log('✅ Phone number associated with trunk');
    } else {
      console.log('ℹ️  Phone number already associated with trunk');
    }
    
    console.log('\n📋 TRUNK CONFIGURATION COMPLETE:');
    console.log('  ✅ Trunk configured with transfer-mode: enable-all');
    console.log('  ✅ Phone number associated with trunk (for SIP REFER permissions)');
    console.log('  ✅ Phone number voiceUrl preserved (for business logic)');
    console.log('\n📞 CALL FLOW:');
    console.log('  Incoming: Twilio → Phone voiceUrl → /api/calls/incoming → LiveKit');
    console.log('  Transfers: LiveKit sends SIP REFER → Twilio trunk (enable-all) → PSTN');
    console.log('\n💡 NOTE: VoiceUrl takes precedence over trunk origination URLs');
    
    return { success: true, trunkSid };
  } catch (error) {
    console.error('❌ Error configuring Twilio trunk transfers:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}


