// ═══════════════════════════════════════════════════════════════
// MIZE SHARED MESSAGE TEMPLATES — messages.js
// Single source of truth for ALL athlete/coach messages.
// Loaded by both GSM (goalie_sessions.html) and Phone App (mize_schedule.html).
// Any message change should ONLY be made here.
// ═══════════════════════════════════════════════════════════════

const MIZE_MESSAGES = (function() {

  // ── Name helpers ─────────────────────────────────────────────
  // Always use nickname if available, otherwise first name
  function preferredName(fullName, nickname) {
    if(nickname && nickname.trim()) return nickname.trim();
    return (fullName||'').split(' ')[0] || '[Name]';
  }

  // Build the "Hi X" greeting based on which recipients are selected.
  // Athlete name always comes first when both are addressed.
  // messageToParent / messageToAthlete: booleans from athlete record.
  // Defaults: if both are false/undefined, fall back to parent only (existing behavior).
  function recipientGreeting(athleteName, athleteNickname, parentName, parentNickname, messageToParent, messageToAthlete) {
    const toParent  = messageToParent !== false;   // default true
    const toAthlete = messageToAthlete === true;    // default false
    const athlete = preferredName(athleteName, athleteNickname);
    const parent   = preferredName(parentName, parentNickname);

    if(toAthlete && toParent) return athlete + ' and ' + parent;
    if(toAthlete && !toParent) return athlete;
    return parent; // parent only (default / explicit)
  }

  // ── Pool LOCATION notes (parking, gate codes — NEVER fee amounts) ──
  // Fee amounts live in ONE place only: poolFeeLine(), driven by the real
  // per-session poolFee data field. This function used to also hardcode a
  // Jake's-Pool $20 fee line, which meant any session at Jake's Pool with
  // poolFee set got the fee mentioned twice (once here, once via
  // poolFeeLine()) — that's the duplication bug. Fixed by removing the
  // fee text here entirely; Jake's Pool now only gets a fee line if/when
  // poolFee is actually set on that session, same as every other location.
  function poolNote(locationStr) {
    const loc = (locationStr||'').toLowerCase();
    if(loc.includes('mara')) {
      return '\n\n- Park on 35th St (by citrus trees)\n- There is a gate into the pool area that may be open - if not, the code is 1972';
    }
    return '';
  }

  // ── Pool fee line ────────────────────────────────────────────
  // Purely informational — states the amount only. Payment instructions
  // live in exactly one place: closingPaymentLine() at the end of the
  // message. See that function's comment for why.
  function poolFeeLine(poolFee) {
    if(!poolFee || Number(poolFee) <= 0) return '';
    return '\n\nThere is a $' + poolFee + ' pool fee for the host family to provide the venue in good condition for our goalie session.';
  }

  // ── Fee unpaid line ──────────────────────────────────────────
  // Purely informational — states the amount only. Payment instructions
  // live in exactly one place: closingPaymentLine() at the end of the
  // message. Deliberately does NOT include pool fee in its breakdown —
  // pool fee always gets its own separate sentence via poolFeeLine().
  // Returns { text, owes } so callers know whether to show the closing
  // payment paragraph.
  function unpaidLine(total, sessionFee, mileageFee, isPaid) {
    if(isPaid || !total || total <= 0) return { owes:false, text:'' };
    const parts = [];
    if(Number(sessionFee||0) > 0) parts.push('$' + sessionFee + ' session fee');
    if(Number(mileageFee||0) > 0) parts.push('$' + mileageFee + ' mileage');
    const breakdown = parts.length > 1 ? ' (' + parts.join(' + ') + ')' : '';
    return { owes:true, text: '\n\nThe fee is $' + total + breakdown + ' to reserve the time slot.' };
  }

  // ── Time range ───────────────────────────────────────────────
  function fmtTime(t) {
    if(!t) return '';
    const m = t.match(/(\d+):(\d+)\s*(am|pm)?/i);
    if(!m) return t;
    let h = parseInt(m[1]), min = parseInt(m[2]);
    const hasMeridiem = !!m[3];
    if(!hasMeridiem) {
      // 24h format
      const suffix = h >= 12 ? 'pm' : 'am';
      if(h > 12) h -= 12;
      if(h === 0) h = 12;
      return h + ':' + String(min).padStart(2,'0') + suffix;
    }
    return h + ':' + String(min).padStart(2,'0') + (m[3]||'').toLowerCase();
  }

  function timeRange(start, end, length) {
    const s = fmtTime(start);
    if(!s) return '';
    if(end && fmtTime(end)) return 'from ' + s + ' to ' + fmtTime(end);
    // Calculate end from length
    if(length && start) {
      const mins = parseInt((length||'').replace(/[^0-9]/g,''));
      if(mins) {
        const [h, mi] = start.split(':').map(Number);
        const total = h * 60 + mi + mins;
        const eh = Math.floor(total/60) % 24;
        const em = total % 60;
        return 'from ' + s + ' to ' + fmtTime(String(eh).padStart(2,'0') + ':' + String(em).padStart(2,'0'));
      }
    }
    return 'at ' + s;
  }

  function fmtDate(dateStr) {
    if(!dateStr) return '';
    const d = new Date(dateStr.slice(0,10) + 'T12:00:00');
    return d.toLocaleDateString('en-US', {weekday:'long', month:'long', day:'numeric'});
  }

  function fmtShort(dateStr) {
    if(!dateStr) return '';
    const d = new Date(dateStr.slice(0,10) + 'T12:00:00');
    return d.toLocaleDateString('en-US', {month:'2-digit', day:'2-digit'});
  }

  function dayLabel(dateStr) {
    if(!dateStr) return '';
    const d = new Date(dateStr.slice(0,10) + 'T12:00:00');
    const today = new Date(); today.setHours(0,0,0,0);
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate()+1);
    d.setHours(0,0,0,0);
    if(d.getTime() === today.getTime()) return "today's";
    if(d.getTime() === tomorrow.getTime()) return "tomorrow's";
    return 'the ' + fmtShort(dateStr);
  }

  // ═══════════════════════════════════════════════════════
  // PRIVATE SESSION CONFIRMATION
  // ═══════════════════════════════════════════════════════
  function privateConfirm(session, athleteName, parentName, isAthlete1, parentNickname, athleteNickname, messageToParent, messageToAthlete, athleteRegion, athleteState) {
    const goalie = preferredName(athleteName, athleteNickname);
    const greeting = recipientGreeting(athleteName, athleteNickname, parentName, parentNickname, messageToParent, messageToAthlete);
    const loc = [session.poolName, session.poolAddress].filter(Boolean).join(', ');
    const locStr = loc ? ' at ' + loc : '';
    let ts = timeRange(session.time, session.endTime, session.length);
    if(ts && needsTimezoneClarifier(athleteState, athleteRegion)) ts = ts + ' (Pacific Time)';
    const tsStr = ts ? ' ' + ts : '';
    const day = dayLabel(session.date);

    const sessionFee = Number(session.fee||0);
    const mileageFee = Number(session.mileageFee||0);
    const poolFeeAmt = Number(session.poolFee||0);
    // Main fee total intentionally EXCLUDES the pool fee — pool fee always
    // gets its own separate explanatory sentence via poolFeeLine(), never
    // folded into the combined-total breakdown. This matches groupConfirm
    // and groupInvite, so pool fee phrasing/payment instructions are
    // consistent everywhere, and a fee is never possible to mention twice.
    const fullTotal  = sessionFee + mileageFee;

    const isSemi = (session.format||'').startsWith('Semi');
    const isPaid = isSemi
      ? (isAthlete1 !== false ? !!session.paid : !!session.paid2)
      : !!session.paid;

    const feeResult = unpaidLine(fullTotal, sessionFee, mileageFee, isPaid);
    // Pool fee is tracked independently of session-fee payment status
    // (see poolFeePaid in goalie_sessions.html) — always mention it here
    // if poolFee>0, regardless of isPaid, matching groupConfirm/groupInvite.
    const poolLine = poolFeeLine(poolFeeAmt) + poolNote(session.poolName);

    return 'Hi ' + greeting + ', this is to confirm the participation of ' + goalie
      + ' in ' + day + ' ' + (session.type||'Private Session') + tsStr + locStr + '.'
      + poolLine + feeResult.text + closingPaymentLine(feeResult.owes, poolFeeAmt)
      + '\n\nSee you there, MIZE';
  }

  // ═══════════════════════════════════════════════════════
  // GROUP SESSION CONFIRMATION
  // ═══════════════════════════════════════════════════════
  function groupConfirm(prog, occ, athleteName, parentName, isPaid, parentNickname, athleteNickname, messageToParent, messageToAthlete, athleteRegion, athleteState) {
    const goalie = preferredName(athleteName, athleteNickname);
    const greeting = recipientGreeting(athleteName, athleteNickname, parentName, parentNickname, messageToParent, messageToAthlete);
    const loc = [occ.location||prog.location, occ.address||prog.address].filter(Boolean).join(', ');
    const locStr = loc ? ' at ' + loc : '';
    let ts = timeRange(occ.startTime||prog.startTime, occ.endTime||prog.endTime, '90 min');
    if(ts && needsTimezoneClarifier(athleteState, athleteRegion)) ts = ts + ' (Pacific Time)';
    const tsStr = ts ? ' ' + ts : '';
    const day = dayLabel(occ.date);
    const sessionFee = Number(prog.sessionFee||175);
    const feeResult = unpaidLine(sessionFee, sessionFee, 0, isPaid);
    const pFee = Number(occ.poolFee||prog.poolFee||0);
    const pLine = poolFeeLine(pFee) + poolNote(occ.location||prog.location);

    return 'Hi ' + greeting + ', this is to confirm the participation of ' + goalie
      + ' in ' + day + ' goalie session' + tsStr + locStr + '.'
      + pLine + feeResult.text + closingPaymentLine(feeResult.owes, pFee)
      + '\n\nSee you there, MIZE';
  }

  // ═══════════════════════════════════════════════════════
  // Shared package/fee phrasing — used by BOTH groupInvite() and
  // groupSpotOpen(). This is the ONE place "package used up", the $750
  // re-up price, and the free-package wording are defined. Previously
  // goalie_sessions.html had its own separate copy of this exact logic
  // for the "last spot open" message, which is how the two message types
  // drifted into slightly different wording over time. Don't duplicate
  // this logic anywhere else — add new fee/package scenarios here only.
  //
  // IMPORTANT: this function is purely INFORMATIONAL — it states what
  // things cost, never how to pay. Payment instructions (Venmo, etc.)
  // live in exactly one place: the closingPaymentLine() at the very end
  // of the message. That's what stops "send by venmo to @MIZE77" from
  // appearing multiple times across different fee paragraphs.
  //
  // Returns { text, owesSessionFee } — owesSessionFee tells the caller
  // whether THIS session's base fee is actually owed (false when fully
  // covered by a free package or a same-session coupon). The optional
  // $750 re-up offer never counts as "owed" — it's a future upsell, not
  // a charge for this session.
  //
  // `signupVerb` lets the two callers ask for different non-package signup
  // phrasing ("please sign up online..." for groupInvite vs "please let
  // me know if X would like to join... first come first serve" for
  // groupSpotOpen) while sharing every package-related branch untouched.
  function packageFeeSection(opts) {
    const { goalie, fee, isHP, hasFreePackage, freePackageCouponCode,
            hasPackage, packageRemaining, couponCode, newPackageCoupon,
            discountCoupon, signupVerb, usedUpSignupVerb } = opts;
    const discountedFee = Math.max(0, fee - 50);

    if(hasFreePackage) {
      return { owesSessionFee: false, text: goalie + ' has a Goalie Free Participation Package, so '
        + (isHP
          ? 'if ' + goalie + ' would like to join this session please text me to reserve the spot and I will confirm by text if it is still available.'
          : ('this session is free. Please sign up at www.theperfectgoalie.com'
              + (freePackageCouponCode ? ' and use your coupon code ' + freePackageCouponCode + ' at checkout so that the fee gets waived.' : ' and let me know so I can reserve the spot.'))) };
    }
    if(hasPackage && packageRemaining > 0 && couponCode) {
      return { owesSessionFee: false, text: 'You still have ' + packageRemaining + ' session' + (packageRemaining !== 1 ? 's' : '')
        + ' left with your Goalie Performance Package. If ' + goalie + ' would like to join this session please '
        + (isHP
          ? 'text me to reserve the spot and I will confirm by text if it is still available.'
          : 'sign up at www.theperfectgoalie.com and use your coupon code ' + couponCode + ' at the checkout so that the fee gets waived.') };
    }
    if(hasPackage && packageRemaining > 0) {
      return { owesSessionFee: false, text: 'You still have ' + packageRemaining + ' session' + (packageRemaining !== 1 ? 's' : '')
        + ' left with your Goalie Performance Package. If ' + goalie
        + ' would like to join this session please text me to reserve the spot and I will confirm by text if it is still available.' };
    }
    if(hasPackage && packageRemaining === 0) {
      // Package is used up — THIS session is no longer free, the normal
      // per-session fee applies. The $750 re-up is a separate, optional
      // offer for FUTURE sessions, so it never counts toward owesSessionFee.
      const signupLine = isHP
        ? 'If ' + goalie + ' would like to join this session please text me to reserve the spot and I will confirm by text if it is still available.'
        : usedUpSignupVerb;
      const newPkgCouponLine = newPackageCoupon
        ? ' Use coupon code ' + newPackageCoupon + ' at checkout to get your new package for free and use your package sessions immediately.'
        : '';
      // The $750 re-up offer appears EXACTLY ONCE here. No caller should
      // ever append a second "$750 / 6 sessions" line on top of this branch.
      return { owesSessionFee: true, text: signupLine + '\n\nYour Goalie Performance Package is now used up. You could purchase a new package for $750 for 6 group sessions directly with me to bring the fee down to $125 per session.' + newPkgCouponLine };
    }
    // No package at all — the per-session fee is owed.
    const discountLine = discountCoupon
      ? '\n\nUse coupon code ' + discountCoupon + ' at checkout to save $50 ($' + discountedFee + ' total).'
      : '\n\nOr $125 when using a voucher from the Goalie Performance Package ($750 for 6 sessions).';
    return { owesSessionFee: true, text: signupVerb + discountLine };
  }

  // ── Closing payment line ────────────────────────────────────
  // The ONE place payment instructions (Venmo handle, "or your preferred
  // method") ever appear in a message. Called once at the very end, after
  // all fee paragraphs have stated their amounts purely informationally.
  // Skipped entirely if nothing is actually owed this time (per product
  // decision: a fully-covered/free session with no pool fee gets no
  // payment paragraph at all).
  function closingPaymentLine(owesSessionFee, poolFee) {
    if(!owesSessionFee && !(Number(poolFee||0) > 0)) return '';
    return '\n\nPlease send your payment by venmo to my account @MIZE77 or by your preferred method of payment.';
  }

  // ═══════════════════════════════════════════════════════
  // GROUP SESSION INVITATION
  // ═══════════════════════════════════════════════════════
  function groupInvite(prog, occ, athleteName, parentName, hasPackage, packageRemaining, couponCode, showPkgOffer, parentNickname, athleteNickname, newPackageCoupon, hasFreePackage, freePackageCouponCode, messageToParent, messageToAthlete, athleteRegion, athleteState) {
    const parent = preferredName(parentName, parentNickname);
    const goalie = preferredName(athleteName, athleteNickname);
    const greeting = recipientGreeting(athleteName, athleteNickname, parentName, parentNickname, messageToParent, messageToAthlete);
    const location = occ.location || prog.location || '[Pool Location]';
    let ts = timeRange(occ.startTime||prog.startTime, occ.endTime||prog.endTime, '90 min');
    if(ts && needsTimezoneClarifier(athleteState, athleteRegion)) ts = ts + ' (Pacific Time)';
    const tsStr = ts ? ' ' + ts : '';
    const sessionDate = new Date((occ.date||'').slice(0,10) + 'T12:00:00');
    const weekday = sessionDate.toLocaleDateString('en-US', {weekday:'long'});
    const dateMMDD = sessionDate.toLocaleDateString('en-US', {month:'2-digit', day:'2-digit'});
    const shortName = prog.name.split(/\s*[–—-]\s*/)[0].replace(/\s*\d+\s*$/, '').trim();
    const fee = prog.sessionFee || 175;
    const discountCoupon = couponCode || prog.discountCoupon || '';
    const isHP = prog.level === 'High Performance';
    const pFee = Number(occ.poolFee||prog.poolFee||0);
    const pLine = poolFeeLine(pFee);
    const jakeLine = poolNote(location);

    let feeResult = packageFeeSection({
      goalie, fee, isHP, hasFreePackage, freePackageCouponCode,
      hasPackage, packageRemaining, couponCode, newPackageCoupon, discountCoupon,
      signupVerb: 'If ' + goalie + ' would like to participate please sign up online at www.theperfectgoalie.com. The fee is $' + fee + ' per session.',
      usedUpSignupVerb: 'If ' + goalie + ' would like to participate please sign up online at www.theperfectgoalie.com. The fee is $' + fee + ' per session.',
    });

    const pkgOfferLine = (showPkgOffer && !hasPackage && !hasFreePackage)
      ? '\n\nYou can also buy a Goalie Performance Package for six goalie sessions within 15 weeks for a total of $750 which brings down the fee per session to $125.'
      : '';

    return 'Hi ' + greeting + ', I hope you are doing well. My next ' + shortName
      + ' will be on ' + weekday + ', ' + dateMMDD + tsStr + ' at ' + location + '. '
      + feeResult.text + pLine + jakeLine + pkgOfferLine + closingPaymentLine(feeResult.owesSessionFee, pFee)
      + '\n\nBest greetings, MIZE';
  }

  // ═══════════════════════════════════════════════════════
  // GROUP SESSION — LAST SPOT OPEN
  // ═══════════════════════════════════════════════════════
  // Same package/fee wording as groupInvite (via the shared
  // packageFeeSection() helper above) — only the opening framing differs:
  // "there is still 1 spot open... first come first serve" instead of
  // a plain invitation. This used to be a separate, hand-copied
  // implementation living in goalie_sessions.html; consolidated here so
  // there's exactly one definition of every fee/package sentence.
  function groupSpotOpen(prog, occ, athleteName, parentName, hasPackage, packageRemaining, couponCode, parentNickname, athleteNickname, newPackageCoupon, hasFreePackage, freePackageCouponCode, messageToParent, messageToAthlete, athleteRegion, athleteState) {
    const goalie = preferredName(athleteName, athleteNickname);
    const greeting = recipientGreeting(athleteName, athleteNickname, parentName, parentNickname, messageToParent, messageToAthlete);
    const location = occ.location || prog.location || '[Pool Location]';
    let ts = timeRange(occ.startTime||prog.startTime, occ.endTime||prog.endTime, '90 min');
    if(ts && needsTimezoneClarifier(athleteState, athleteRegion)) ts = ts + ' (Pacific Time)';
    const tsStr = ts ? ' ' + ts : '';
    const sessionDate = new Date((occ.date||'').slice(0,10) + 'T12:00:00');
    const weekday = sessionDate.toLocaleDateString('en-US', {weekday:'long'});
    const shortName = prog.name.split(/\s*[–—-]\s*/)[0].replace(/\s*\d+\s*$/, '').trim();
    const fee = prog.sessionFee || 175;
    const discountCoupon = couponCode || prog.discountCoupon || '';
    const isHP = prog.level === 'High Performance';
    const pFee = Number(occ.poolFee||prog.poolFee||0);
    const pLine = poolFeeLine(pFee);
    const jakeLine = poolNote(location);

    const feeResult = packageFeeSection({
      goalie, fee, isHP, hasFreePackage, freePackageCouponCode,
      hasPackage, packageRemaining, couponCode, newPackageCoupon, discountCoupon,
      signupVerb: 'The fee is $' + fee + ' for a single sign up. I am granting the final spot on a first come first serve basis.',
      usedUpSignupVerb: 'The fee is $' + fee + ' for a single sign up. I am granting the final spot on a first come first serve basis.',
    });

    return 'Hi ' + greeting + ', I hope you are doing well. For my ' + shortName + ' this ' + weekday
      + ' at ' + location + tsStr + ' there is still 1 spot open. Please let me know if ' + goalie + ' would like to join. '
      + feeResult.text + pLine + jakeLine + closingPaymentLine(feeResult.owesSessionFee, pFee)
      + '\n\nHave a great day, MIZE';
  }

  // ═══════════════════════════════════════════════════════
  // MEETING CONFIRMATION
  // ═══════════════════════════════════════════════════════
  // Regions known to already be in Pacific Time — used only as a fallback
  // when an athlete's state isn't filled out yet.
  const PACIFIC_REGIONS = ['Orange County','San Diego','Manhattan Beach','North Los Angeles','NorCal','Santa Barbara'];

  // Decide whether a "(Pacific Time)" clarifier is needed for session/meeting
  // times. State is the precise signal (CA = no clarifier, any other state
  // or "International" = clarifier). Falls back to region only when state
  // hasn't been set for that athlete yet.
  function needsTimezoneClarifier(state, region) {
    if(state) return state !== 'CA';
    if(!region) return true; // no state and no region — be safe, clarify
    return !PACIFIC_REGIONS.includes(region);
  }

  function meetingConfirm(meeting, athleteName, parentName, parentNickname, athleteRegion, athleteState) {
    const parent = preferredName(parentName, parentNickname);
    const tl = meeting.meetingType === 'Other' ? meeting.otherType : meeting.meetingType;
    let ts = timeRange(meeting.time, '', meeting.length);
    if(ts && needsTimezoneClarifier(athleteState, athleteRegion)) ts = ts + ' (Pacific Time)';
    const tsStr = ts ? ' ' + ts : '';
    const locStr = meeting.location ? ' at ' + meeting.location : '';
    const feeLine = !meeting.isFree && meeting.fee
      ? '\n\nPlease venmo the fee of $' + meeting.fee + ' to my account @MIZE77 to reserve the time slot.'
      : '';
    const topicsStr = meeting.topics
      ? '\n\nTopics we will cover:\n' + meeting.topics.split(/[\n,]+/).map(t=>t.trim()).filter(Boolean).map(t=>'- '+t).join('\n')
      : '';
    return 'Hi ' + parent + ',\n\nThis is to confirm our upcoming ' + tl
      + ' on ' + fmtDate(meeting.date) + tsStr + locStr + '.'
      + topicsStr + feeLine
      + '\n\nPlease let me know if this works for you or if you need to reschedule.\n\nBest greetings, MIZE';
  }

  // ═══════════════════════════════════════════════════════
  // COACH CONFIRMATION
  // ═══════════════════════════════════════════════════════
  function coachConfirm(coachName, eventName, date, startTime, endTime, location, address, isRemote, coachNickname) {
    const locFull = [location, address].filter(Boolean).join(', ');
    const ts = timeRange(startTime, endTime, '90 min');
    return 'Hi ' + preferredName(coachName, coachNickname) + ', this is to confirm your coaching assignment'
      + (eventName ? ' for ' + eventName : '')
      + ' on ' + fmtDate(date)
      + (ts ? ' ' + ts : '')
      + (isRemote ? ' via Zoom.' : (locFull ? ' at ' + locFull + '.' : '.'))
      + (!isRemote ? '\n\nPlease make sure to arrive 10 minutes early and help with clean-up at the end of the session.' : '')
      + '\n\nThank you!\nMIZE';
  }

  // Public API
  return {
    privateConfirm,
    groupConfirm,
    groupInvite,
    groupSpotOpen,
    meetingConfirm,
    coachConfirm,
    preferredName,
    recipientGreeting,
    needsTimezoneClarifier,
    PACIFIC_REGIONS,
    // Utilities (exported for reuse)
    poolNote,
    poolFeeLine,
    unpaidLine,
    fmtTime,
    timeRange,
    fmtDate,
    fmtShort,
    dayLabel,
  };

})();
