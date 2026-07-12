// ═══════════════════════════════════════════════════════════════
// MIZE SHARED MESSAGE TEMPLATES — messages.js
// Single source of truth for ALL athlete/coach messages.
// Loaded by GSM (goalie_sessions.html) and Phone App (index.html on GitHub Pages).
// Any message change — confirmation, invitation, coach — ONLY goes here.
// ═══════════════════════════════════════════════════════════════

const MIZE_MESSAGES = (function() {

  // ── Name helpers ─────────────────────────────────────────────────────────
  // Always prefer nickname, fall back to first name of full name.
  function preferredName(fullName, nickname) {
    if(nickname && nickname.trim()) return nickname.trim();
    return (fullName||'').split(' ')[0] || '[Name]';
  }

  // Build the "Hi X" greeting based on which recipients are selected.
  // Athlete always comes first when both are addressed.
  // Defaults: messageToParent=true, messageToAthlete=false.
  function recipientGreeting(athleteName, athleteNickname, parentName, parentNickname, messageToParent, messageToAthlete) {
    const toParent  = messageToParent !== false;
    const toAthlete = messageToAthlete === true;
    const goalie = preferredName(athleteName, athleteNickname);
    const parent = preferredName(parentName, parentNickname);
    if(toAthlete && toParent)  return goalie + ' and ' + parent;
    if(toAthlete && !toParent) return goalie;
    return parent;
  }

  // ── Time helpers ─────────────────────────────────────────────────────────
  function fmtTime(t) {
    if(!t) return '';
    const m = t.match(/(\d+):(\d+)\s*(am|pm)?/i);
    if(!m) return t;
    let h = parseInt(m[1]), min = parseInt(m[2]);
    if(!m[3]) {
      // 24-hour → 12-hour
      const sfx = h >= 12 ? 'pm' : 'am';
      if(h > 12) h -= 12;
      if(h === 0) h = 12;
      return h + ':' + String(min).padStart(2,'0') + sfx;
    }
    return h + ':' + String(min).padStart(2,'0') + (m[3]||'').toLowerCase();
  }

  function timeRange(start, end, fallbackLength) {
    const s = fmtTime(start);
    if(!s) return '';
    if(end && fmtTime(end)) return 'from ' + s + ' to ' + fmtTime(end);
    if(fallbackLength && start) {
      const mins = parseInt((fallbackLength||'').replace(/[^0-9]/g,''));
      if(mins) {
        const [h, mi] = start.split(':').map(Number);
        const tot = h * 60 + mi + mins;
        const eh = Math.floor(tot/60) % 24;
        const em = tot % 60;
        return 'from ' + s + ' to ' + fmtTime(String(eh).padStart(2,'0') + ':' + String(em).padStart(2,'0'));
      }
    }
    return 'at ' + s;
  }

  // ── Date helpers ─────────────────────────────────────────────────────────
  function parseDate(dateStr) {
    // Always parse at noon local to avoid timezone-shift edge cases
    return new Date((dateStr||'').slice(0,10) + 'T12:00:00');
  }

  function fmtDate(dateStr) {
    if(!dateStr) return '';
    return parseDate(dateStr).toLocaleDateString('en-US', {weekday:'long', month:'long', day:'numeric'});
  }

  function fmtShort(dateStr) {
    if(!dateStr) return '';
    return parseDate(dateStr).toLocaleDateString('en-US', {month:'2-digit', day:'2-digit'});
  }

  // Returns { dayWord, needsOn }
  // dayWord: 'today', 'tomorrow', or 'Monday, 07/06' etc.
  // needsOn:  true  → prepend 'on ' before dayWord
  //           false → no 'on', use dayWord directly (today/tomorrow)
  function dayInfo(dateStr) {
    if(!dateStr) return { dayWord: '', needsOn: false };
    const d = parseDate(dateStr);
    const today    = new Date(); today.setHours(0,0,0,0);
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate()+1);
    d.setHours(0,0,0,0);
    if(d.getTime() === today.getTime())    return { dayWord: 'today',    needsOn: false };
    if(d.getTime() === tomorrow.getTime()) return { dayWord: 'tomorrow', needsOn: false };
    const weekday = parseDate(dateStr).toLocaleDateString('en-US', {weekday:'long'});
    return { dayWord: weekday + ', ' + fmtShort(dateStr), needsOn: true };
  }

  // ── Timezone clarifier ───────────────────────────────────────────────────
  const PACIFIC_REGIONS = ['Orange County','San Diego','Manhattan Beach','North Los Angeles','NorCal','Santa Barbara'];

  function needsTimezoneClarifier(state, region) {
    if(state)   return state !== 'CA';
    if(!region) return true;
    return !PACIFIC_REGIONS.includes(region);
  }

  // ── Program name helper ──────────────────────────────────────────────────
  // Drops the region/level suffix after a dash: 'Goalie Group - OC' → 'Goalie Group'
  function shortProgName(name) {
    return (name||'').trim();
  }

  // ── City extraction ──────────────────────────────────────────────────────
  // Best-effort: try the second part of a "Name, City, State" address,
  // otherwise return empty string.
  function cityFromAddress(address) {
    if(!address) return '';
    const parts = address.split(',');
    if(parts.length >= 2) return parts[1].trim();
    return '';
  }

  // ── Pool location notes (parking, gate codes — NEVER fee amounts) ────────
  function poolNote(locationStr) {
    const loc = (locationStr||'').toLowerCase();
    if(loc.includes('mara')) {
      return '\n\n- Park on 35th St (by citrus trees)\n- There is a gate into the pool area that may be open — if not, the code is 1972';
    }
    return '';
  }

  // ══════════════════════════════════════════════════════════════════════════
  //
  //  ATHLETE CONFIRMATION  (private sessions AND group sessions)
  //
  //  Element order:
  //    1  Personal greeting
  //    2  Event confirmation (event name, goalie, day/date, pool name + address)
  //    3  Session fee (if unpaid) — with breakdown when multiple components
  //    4  Package offer (only if unpaid + showPkgOffer flag)
  //    5  Pool fee (if applicable)
  //    6  Mileage fee (if applicable)
  //    8  Payment line — itemized list then single combined total (if anything owed)
  //    9  Pool-specific location notes (parking, gate codes)
  //   10  Sign-off
  //
  //  Payment line appears EXACTLY ONCE, at element 8, covering every open fee
  //  together. No individual fee paragraph ever mentions Venmo or @MIZE77.
  //
  // ══════════════════════════════════════════════════════════════════════════

  // Shared confirmation builder — called by both privateConfirm and groupConfirm.
  // opts = {
  //   greeting, goalie,
  //   eventName,           // e.g. 'Goalie Group' or 'Private Session'
  //   dateStr,             // YYYY-MM-DD
  //   startTime, endTime, sessionLength,
  //   poolName, poolAddress,
  //   sessionFee, mileageFee, poolFee,
  //   isPaid,
  //   showPkgOffer,        // boolean flag from athlete record
  //   athleteRegion, athleteState,
  // }
  function buildConfirmation(opts) {
    const {
      greeting, goalie,
      eventName, dateStr,
      startTime, endTime, sessionLength,
      poolName, poolAddress,
      sessionFee, mileageFee, poolFee,
      isPaid,
      showPkgOffer,
      isPoolOwner,      // true when the confirmed athlete owns this pool
      poolAccessNotes,  // from pool.accessNotes in GSM pools data
      athleteRegion, athleteState,
    } = opts;

    // ── Element 1: Personal greeting ──────────────────────────────────────
    const el1 = 'Hi ' + greeting + ', I hope everything is going well with you.';

    // ── Element 2: Confirmation of the event ──────────────────────────────
    const { dayWord, needsOn } = dayInfo(dateStr);
    const dayStr = needsOn ? 'on ' + dayWord : dayWord;
    let ts = timeRange(startTime, endTime, sessionLength);
    if(ts && needsTimezoneClarifier(athleteState, athleteRegion)) ts += ' (Pacific Time)';
    const tsStr  = ts ? ' ' + ts : '';
    const locStr = poolName ? ' at ' + poolName + (poolAddress ? ' located at ' + poolAddress : '') : '';
    const el2 = 'I am confirming the ' + eventName + ' for ' + goalie + ' ' + dayStr + tsStr + locStr + '.';

    // ── Elements 3–6 & 8: Fees ────────────────────────────────────────────
    // We collect each open fee as { label, amount } so element 8 can list
    // them individually and then add the combined total.
    const sf = Number(sessionFee||0);
    const mf = Number(mileageFee||0);
    const pf = Number(poolFee||0);

    let el3 = '';   // session fee line
    let el4 = '';   // package offer line
    let el5 = '';   // pool fee line
    let el6 = '';   // mileage fee line
    let el8 = '';   // payment line

    const openFees = []; // { label, amount } for payment itemization

    if(!isPaid && sf > 0) {
      if(mf > 0) {
        openFees.push({ label: 'session fee', amount: sf });
        openFees.push({ label: 'mileage fee', amount: mf });
      } else {
        openFees.push({ label: 'session fee', amount: sf });
      }
    } else if(!isPaid && mf > 0) {
      openFees.push({ label: 'mileage fee', amount: mf });
    }

    // Element 4 — package offer (only if unpaid AND flag checked)
    if(!isPaid && showPkgOffer) {
      el4 = 'If ' + goalie + ' is planning to join consistently in my goalie sessions I would like to offer you the Goalie Performance Package with 6 group sessions for $750 which brings down the fee per session to just $125.';
    }

    // Pool fee — skipped for pool owner/host (they don't pay their own pool fee)
    if(pf > 0 && !isPoolOwner) {
      openFees.push({ label: 'pool fee', amount: pf });
      el5 = 'There is a $' + pf + ' pool fee for the host family to provide the venue in good condition for our goalie training session.';
    }

    // Element 8 — single payment paragraph covering all open fees
    if(openFees.length > 0) {
      const total = openFees.reduce((s, f) => s + f.amount, 0);
      let itemized;
      if(openFees.length === 1) {
        itemized = '$' + total;
      } else {
        itemized = openFees.map(f => '$' + f.amount + ' ' + f.label).join(' + ') + ' = $' + total;
      }
      el8 = 'Please send the open fee of ' + itemized + ' by venmo to my account @MIZE77 or let me know if you prefer a different method of payment.';
    }

    // ── Element 9: Pool access notes ──────────────────────────────────────
    // Uses the pool's accessNotes field (set in GSM Pools tab).
    // Skipped entirely if the athlete is the owner of this pool —
    // they already know how to get in.
    // Falls back to the legacy hardcoded poolNote() for pools that
    // haven't been migrated to the new accessNotes field yet.
    const el9 = (() => {
      if(isPoolOwner) return '';
      if(poolAccessNotes) return '\n\n' + poolAccessNotes.trim();
      return poolNote(poolName || '');  // legacy fallback
    })();

    // ── Element 10: Sign-off ──────────────────────────────────────────────
    const el10 = 'I look forward seeing you there. Best greetings, MIZE';

    // ── Assemble — blank lines between non-empty elements ─────────────────
    const elements = [el1, el2, el4, el5, el8].filter(Boolean);
    let body = elements.join('\n\n');
    if(el9) body += el9;           // pool note already starts with \n\n
    body += '\n\n' + el10;

    return body;
  }

  // ── Private session confirmation ──────────────────────────────────────────
  function privateConfirm(session, athleteName, parentName, isAthlete1, parentNickname, athleteNickname, messageToParent, messageToAthlete, athleteRegion, athleteState, showPkgOffer, pools, athletePoolId) {
    const goalie   = preferredName(athleteName, athleteNickname);
    const greeting = recipientGreeting(athleteName, athleteNickname, parentName, parentNickname, messageToParent, messageToAthlete);
    const isSemi   = (session.format||'').startsWith('Semi');
    const isPaid   = isSemi ? (isAthlete1 !== false ? !!session.paid : !!session.paid2) : !!session.paid;
    // Resolve pool record from pools list using pool name match
    const poolRec  = (pools||[]).find(p => p.name && session.poolName && p.name.toLowerCase() === session.poolName.toLowerCase());
    const isPoolOwner = !!(poolRec && athletePoolId && poolRec.id === athletePoolId);
    return buildConfirmation({
      greeting, goalie,
      eventName:      session.type || 'Private Session',
      dateStr:        session.date,
      startTime:      session.time,
      endTime:        session.endTime,
      sessionLength:  session.length,
      poolName:       session.poolName,
      poolAddress:    session.poolAddress,
      sessionFee:     Number(session.fee||0),
      mileageFee:     Number(session.mileageFee||0),
      poolFee:        Number(session.poolFee||0),
      isPaid,
      showPkgOffer:   !!showPkgOffer,
      isPoolOwner,
      poolAccessNotes: poolRec?.accessNotes || '',
      athleteRegion, athleteState,
    });
  }

  // ── Group session confirmation ────────────────────────────────────────────
  function groupConfirm(prog, occ, athleteName, parentName, isPaid, parentNickname, athleteNickname, messageToParent, messageToAthlete, athleteRegion, athleteState, showPkgOffer, pools, athletePoolId) {
    const goalie    = preferredName(athleteName, athleteNickname);
    const greeting  = recipientGreeting(athleteName, athleteNickname, parentName, parentNickname, messageToParent, messageToAthlete);
    const poolName  = occ.location || prog.location;
    const poolRec   = (pools||[]).find(p => p.name && poolName && p.name.toLowerCase() === poolName.toLowerCase());
    const isPoolOwner = !!(poolRec && athletePoolId && poolRec.id === athletePoolId);
    return buildConfirmation({
      greeting, goalie,
      eventName:    shortProgName(prog.name),
      dateStr:      occ.date,
      startTime:    occ.startTime || prog.startTime,
      endTime:      occ.endTime   || prog.endTime,
      sessionLength: '90 min',
      poolName,
      poolAddress:  occ.address   || prog.address,
      sessionFee:   Number(prog.sessionFee||175),
      mileageFee:   0,
      poolFee:      isPoolOwner ? 0 : Number(occ.poolFee||prog.poolFee||0),
      isPaid:       !!isPaid,
      showPkgOffer: !!showPkgOffer,
      isPoolOwner,
      poolAccessNotes: poolRec?.accessNotes || '',
      athleteRegion, athleteState,
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  //
  //  ATHLETE INVITATION  (group sessions)
  //
  //  packageFeeSection() handles every package/free-package/no-package branch
  //  and is shared by groupInvite and groupSpotOpen.  All fee paragraphs are
  //  purely informational; payment instructions live only in closingPaymentLine().
  //
  // ══════════════════════════════════════════════════════════════════════════

  // Returns { text, owesSessionFee }.
  // owesSessionFee = false means the session itself is covered (package,
  // free package, coupon) so the closing payment line can be skipped IF
  // there's also no pool fee.
  function packageFeeSection(opts) {
    const { goalie, fee, isHP, hasFreePackage, freePackageCouponCode,
            hasPackage, packageRemaining, couponCode, newPackageCoupon,
            discountCoupon, signupVerb, usedUpSignupVerb } = opts;
    const discountedFee = Math.max(0, fee - 50);

    // Priority 1: free participation package
    if(hasFreePackage) {
      return { owesSessionFee: false, text: goalie + ' has a Goalie Free Participation Package, so '
        + (isHP
          ? 'if ' + goalie + ' would like to join this session please text me to reserve the spot and I will confirm by text if it is still available.'
          : ('this session is free. Please sign up at www.theperfectgoalie.com'
              + (freePackageCouponCode
                  ? ' and use your coupon code ' + freePackageCouponCode + ' at checkout so that the fee gets waived.'
                  : ' and let me know so I can reserve the spot.'))) };
    }

    // Priority 2: active package + coupon (session covered by the coupon)
    if(hasPackage && packageRemaining > 0 && couponCode) {
      return { owesSessionFee: false, text: 'You still have ' + packageRemaining
        + ' session' + (packageRemaining !== 1 ? 's' : '') + ' left with your Goalie Performance Package. If ' + goalie + ' would like to join this session please '
        + (isHP
          ? 'text me to reserve the spot and I will confirm by text if it is still available.'
          : 'sign up at www.theperfectgoalie.com and use your coupon code ' + couponCode + ' at the checkout so that the fee gets waived.') };
    }

    // Priority 3: active package, sessions remaining, no coupon needed
    if(hasPackage && packageRemaining > 0) {
      return { owesSessionFee: false, text: 'You still have ' + packageRemaining
        + ' session' + (packageRemaining !== 1 ? 's' : '') + ' left with your Goalie Performance Package. If ' + goalie
        + ' would like to join this session please text me to reserve the spot and I will confirm by text if it is still available.' };
    }

    // Priority 4: package fully used up — session fee is now owed
    if(hasPackage && packageRemaining === 0) {
      const signupLine = isHP
        ? 'If ' + goalie + ' would like to join this session please text me to reserve the spot and I will confirm by text if it is still available.'
        : usedUpSignupVerb;
      const newPkgLine = newPackageCoupon
        ? ' Use coupon code ' + newPackageCoupon + ' at checkout to get your new package for free and use your package sessions immediately.'
        : '';
      // $750 re-up mentioned EXACTLY ONCE here — never add a second mention elsewhere.
      return { owesSessionFee: true, text: signupLine
        + '\n\nYour Goalie Performance Package is now used up. You could purchase a new package for $750 for 6 group sessions directly with me to bring the fee down to $125 per session.' + newPkgLine };
    }

    // Priority 5: no package at all
    const discountLine = discountCoupon
      ? '\n\nUse coupon code ' + discountCoupon + ' at checkout to save $50 ($' + discountedFee + ' total).'
      : '\n\nYou can also purchase a Goalie Performance Package that includes 6 goalie group sessions within 15 weeks for $750. This would bring down the cost per session to $125.';
    return { owesSessionFee: true, text: signupVerb + discountLine };
  }

  // Single payment instruction — called once at the very end of every invitation.
  // Omitted entirely when nothing is owed (free session + no pool fee).
  function closingPaymentLine(owesSessionFee, poolFee) {
    if(!owesSessionFee && !(Number(poolFee||0) > 0)) return '';
    return '\n\nPlease send your payment by venmo to my account @MIZE77 or by your preferred method of payment.';
  }

  // ── Group session invitation ──────────────────────────────────────────────
  function groupInvite(prog, occ, athleteName, parentName, hasPackage, packageRemaining, couponCode, showPkgOffer, parentNickname, athleteNickname, newPackageCoupon, hasFreePackage, freePackageCouponCode, messageToParent, messageToAthlete, athleteRegion, athleteState) {
    const goalie   = preferredName(athleteName, athleteNickname);
    const greeting = recipientGreeting(athleteName, athleteNickname, parentName, parentNickname, messageToParent, messageToAthlete);
    const location = occ.location || prog.location || '[Pool Location]';
    let ts = timeRange(occ.startTime||prog.startTime, occ.endTime||prog.endTime, '90 min');
    if(ts && needsTimezoneClarifier(athleteState, athleteRegion)) ts += ' (Pacific Time)';
    const tsStr    = ts ? ' ' + ts : '';
    const { dayWord, needsOn } = dayInfo(occ.date);
    const dayStr   = needsOn ? 'on ' + dayWord : dayWord;
    const sName    = shortProgName(prog.name);
    const fee      = prog.sessionFee || 175;
    const pFee     = Number(occ.poolFee||prog.poolFee||0);
    const discountCoupon = couponCode || prog.discountCoupon || '';
    const isHP     = prog.level === 'High Performance';

    const feeResult = packageFeeSection({
      goalie, fee, isHP, hasFreePackage, freePackageCouponCode,
      hasPackage, packageRemaining, couponCode, newPackageCoupon, discountCoupon,
      signupVerb:     'If ' + goalie + ' would like to participate please sign up online at www.theperfectgoalie.com. The fee is $' + fee + ' per session.',
      usedUpSignupVerb: 'If ' + goalie + ' would like to participate please sign up online at www.theperfectgoalie.com. The fee is $' + fee + ' per session.',
    });

    const pkgOfferLine = (showPkgOffer && !hasPackage && !hasFreePackage)
      ? '\n\nYou can also purchase a Goalie Performance Package that includes 6 goalie group sessions within 15 weeks for $750. This would bring down the cost per session to $125.'
      : '';

    const pLine  = pFee > 0 ? '\n\nThere is an additional pool fee of $' + pFee + ' that goes to the host family for providing their pool for this session.' : '';
    const note   = poolNote(location);
    const pay    = closingPaymentLine(feeResult.owesSessionFee, pFee);

    return 'Hi ' + greeting + ', I hope you are doing well. My next ' + sName
      + ' will be ' + dayStr + tsStr + ' at ' + location + '. '
      + feeResult.text + pkgOfferLine + pLine + note + pay
      + '\n\nBest greetings, MIZE';
  }

  // ── Group session — last spot open ────────────────────────────────────────
  function groupSpotOpen(prog, occ, athleteName, parentName, hasPackage, packageRemaining, couponCode, parentNickname, athleteNickname, newPackageCoupon, hasFreePackage, freePackageCouponCode, messageToParent, messageToAthlete, athleteRegion, athleteState) {
    const goalie   = preferredName(athleteName, athleteNickname);
    const greeting = recipientGreeting(athleteName, athleteNickname, parentName, parentNickname, messageToParent, messageToAthlete);
    const location = occ.location || prog.location || '[Pool Location]';
    let ts = timeRange(occ.startTime||prog.startTime, occ.endTime||prog.endTime, '90 min');
    if(ts && needsTimezoneClarifier(athleteState, athleteRegion)) ts += ' (Pacific Time)';
    const tsStr    = ts ? ' ' + ts : '';
    const sessionDate = parseDate(occ.date);
    const weekday  = sessionDate.toLocaleDateString('en-US', {weekday:'long'});
    const sName    = shortProgName(prog.name);
    const fee      = prog.sessionFee || 175;
    const pFee     = Number(occ.poolFee||prog.poolFee||0);
    const discountCoupon = couponCode || prog.discountCoupon || '';
    const isHP     = prog.level === 'High Performance';

    const feeResult = packageFeeSection({
      goalie, fee, isHP, hasFreePackage, freePackageCouponCode,
      hasPackage, packageRemaining, couponCode, newPackageCoupon, discountCoupon,
      signupVerb:       'The fee is $' + fee + ' for a single sign up. I am granting the final spot on a first come first serve basis.',
      usedUpSignupVerb: 'The fee is $' + fee + ' for a single sign up. I am granting the final spot on a first come first serve basis.',
    });

    const pLine = pFee > 0 ? '\n\nThere is an additional pool fee of $' + pFee + ' that goes to the host family for providing their pool for this session.' : '';
    const note  = poolNote(location);
    const pay   = closingPaymentLine(feeResult.owesSessionFee, pFee);

    return 'Hi ' + greeting + ', I hope you are doing well. For my ' + sName + ' this ' + weekday
      + ' at ' + location + tsStr + ' there is still 1 spot open. Please let me know if ' + goalie + ' would like to join. '
      + feeResult.text + pLine + note + pay
      + '\n\nHave a great day, MIZE';
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  MEETING CONFIRMATION
  // ══════════════════════════════════════════════════════════════════════════
  function meetingConfirm(meeting, athleteName, parentName, parentNickname, athleteRegion, athleteState) {
    const parent = preferredName(parentName, parentNickname);
    const tl     = meeting.meetingType === 'Other' ? meeting.otherType : meeting.meetingType;
    let ts = timeRange(meeting.time, '', meeting.length);
    if(ts && needsTimezoneClarifier(athleteState, athleteRegion)) ts += ' (Pacific Time)';
    const tsStr  = ts ? ' ' + ts : '';
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

  // ══════════════════════════════════════════════════════════════════════════
  //  COACH CONFIRMATION
  // ══════════════════════════════════════════════════════════════════════════
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

  // ══════════════════════════════════════════════════════════════════════════
  //  Public API
  // ══════════════════════════════════════════════════════════════════════════
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
    // Utilities (exported for GSM / phone-app callers that use them directly)
    poolNote,
    fmtTime,
    timeRange,
    fmtDate,
    fmtShort,
    dayInfo,
  };

})();
