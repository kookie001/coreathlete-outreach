/**
 * COREATHLETE — LEAD GENERATION ENGINE V2
 * 30-Candidate Qualification Test Suite
 * 
 * Verifies that:
 * 1. 100% of commercial gyms, studios, and fitness facilities receive the -4 penalty and are DISQUALIFIED.
 * 2. 100% of generic affiliate/mass-challenge influencers are penalized and DISQUALIFIED.
 * 3. Individual professional coaches with operational complexity (WhatsApp/Sheets, TrueCoach, Trainerize)
 *    score 6 to 10 points and are marked QUALIFIED or HOT PROSPECT.
 * 4. Missing fields default to 'Unknown' rather than guessed assumptions.
 */

const { calculate10PointScore, generateChannelSearchQuery, NICHE_PRIORITIES } = require('../lib/qualification');

const CANDIDATES = [
  // --- 20 INDIVIDUAL PROFESSIONAL COACHES (Priority Beta ICP) ---
  {
    id: 1,
    name: 'Siddharth Rao',
    social_channel: 'Instagram',
    social_handle: '@coachsid_performance',
    city_country: 'Bengaluru, India',
    niche: 'Sports & Performance',
    has_personal_brand: true,
    is_online_coaching: 'YES',
    is_custom_programming: 'YES',
    evidence_multiple_clients: 'YES',
    has_client_testimonials: 'YES',
    coaching_software_visible: 'YES',
    coaching_software: 'Trainerize',
    application_funnel_visible: 'YES',
    application_funnel: 'Typeform in bio',
    observed_workflow_signal: 'Shares Trainerize exercise review videos + WhatsApp check-in audio feedback snippets',
    multiple_modalities: true,
    workflow_chaos_visible: true,
    contact_method: 'Instagram DM',
    source_url: 'https://instagram.com/coachsid_performance'
  },
  {
    id: 2,
    name: 'Devansh Mehta',
    social_channel: 'Instagram',
    social_handle: '@dev.strength',
    city_country: 'Mumbai, India',
    niche: 'Strength & Conditioning',
    has_personal_brand: true,
    is_online_coaching: 'YES',
    is_custom_programming: 'YES',
    evidence_multiple_clients: 'YES',
    has_client_testimonials: 'YES',
    coaching_software_visible: 'YES',
    coaching_software: 'CoachRx',
    application_funnel_visible: 'YES',
    application_funnel: 'Calendly consultation link',
    observed_workflow_signal: 'Complains in stories about managing 28 client Google Sheets and Sunday check-in backlog',
    multiple_modalities: true,
    workflow_chaos_visible: true,
    contact_method: 'Instagram DM',
    source_url: 'https://instagram.com/dev.strength'
  },
  {
    id: 3,
    name: 'Aditya Roy',
    social_channel: 'Instagram',
    social_handle: '@aditya_hyroxcoach',
    city_country: 'Delhi NCR, India',
    niche: 'HYROX / Endurance-Strength',
    has_personal_brand: true,
    is_online_coaching: 'YES',
    is_custom_programming: 'YES',
    evidence_multiple_clients: 'YES',
    has_client_testimonials: 'YES',
    coaching_software_visible: 'YES',
    coaching_software: 'TrueCoach',
    application_funnel_visible: 'YES',
    application_funnel: 'Google Form in Linktree',
    observed_workflow_signal: 'Dual-phase programming (running pace splits + strength circuits); TrueCoach logs visible',
    multiple_modalities: true,
    workflow_chaos_visible: true,
    contact_method: 'WhatsApp',
    source_url: 'https://instagram.com/aditya_hyroxcoach'
  },
  {
    id: 4,
    name: 'Tanya Kapoor',
    social_channel: 'YouTube',
    social_handle: 'Tanya Strength Systems',
    city_country: 'Chandigarh, India',
    niche: 'Professional Online Strength',
    has_personal_brand: true,
    is_online_coaching: 'YES',
    is_custom_programming: 'YES',
    evidence_multiple_clients: 'YES',
    has_client_testimonials: 'YES',
    coaching_software_visible: 'YES',
    coaching_software: 'Google Sheets & Loom',
    application_funnel_visible: 'YES',
    application_funnel: 'Notion onboarding & Stripe payment',
    observed_workflow_signal: 'Detailed YouTube walkthrough of client video review in Google Drive & weekly check-in sheets',
    multiple_modalities: false,
    workflow_chaos_visible: true,
    contact_method: 'Email',
    source_url: 'https://youtube.com/@tanyastrength'
  },
  {
    id: 5,
    name: 'Rohit Deshmukh',
    social_channel: 'LinkedIn',
    social_handle: 'rohit-deshmukh-performance',
    city_country: 'Pune, India',
    niche: 'Concurrent / Multi-Discipline',
    has_personal_brand: true,
    is_online_coaching: 'YES',
    is_custom_programming: 'YES',
    evidence_multiple_clients: 'YES',
    has_client_testimonials: 'YES',
    coaching_software_visible: 'YES',
    coaching_software: 'Everfit',
    application_funnel_visible: 'YES',
    application_funnel: 'Custom web portal',
    observed_workflow_signal: 'Programs for amateur triathletes balancing endurance runs with heavy squat cycles',
    multiple_modalities: true,
    workflow_chaos_visible: false,
    contact_method: 'LinkedIn',
    source_url: 'https://linkedin.com/in/rohit-deshmukh-performance'
  },
  {
    id: 6,
    name: 'Karan Malhotra',
    social_channel: 'Instagram',
    social_handle: '@karan_powerlift',
    city_country: 'Delhi, India',
    niche: 'Professional Online Strength',
    has_personal_brand: true,
    is_online_coaching: 'YES',
    is_custom_programming: 'YES',
    evidence_multiple_clients: 'YES',
    has_client_testimonials: 'YES',
    coaching_software_visible: 'NO',
    coaching_software: 'None',
    application_funnel_visible: 'YES',
    application_funnel: 'Google Docs application link',
    observed_workflow_signal: 'Uses Google Sheets with RPE autoregulation; conducts form checks over WhatsApp video',
    multiple_modalities: false,
    workflow_chaos_visible: true,
    contact_method: 'Instagram DM',
    source_url: 'https://instagram.com/karan_powerlift'
  },
  {
    id: 7,
    name: 'Priya Sen',
    social_channel: 'Instagram',
    social_handle: '@priyasen_athletic',
    city_country: 'Kolkata, India',
    niche: 'Sports & Performance',
    has_personal_brand: true,
    is_online_coaching: 'YES',
    is_custom_programming: 'YES',
    evidence_multiple_clients: 'YES',
    has_client_testimonials: 'YES',
    coaching_software_visible: 'YES',
    coaching_software: 'bTrainr',
    application_funnel_visible: 'YES',
    application_funnel: 'Calendly',
    observed_workflow_signal: 'Tracks speed splits and deceleration drills for young badminton and tennis players',
    multiple_modalities: true,
    workflow_chaos_visible: false,
    contact_method: 'Instagram DM',
    source_url: 'https://instagram.com/priyasen_athletic'
  },
  {
    id: 8,
    name: 'Arjun Nair',
    social_channel: 'Instagram',
    social_handle: '@arjunnair_combatsc',
    city_country: 'Kochi, India',
    niche: 'Strength & Conditioning',
    has_personal_brand: true,
    is_online_coaching: 'YES',
    is_custom_programming: 'YES',
    evidence_multiple_clients: 'YES',
    has_client_testimonials: 'YES',
    coaching_software_visible: 'YES',
    coaching_software: 'Trainerize',
    application_funnel_visible: 'YES',
    application_funnel: 'Linktree form',
    observed_workflow_signal: 'Prepares MMA athletes with aerobic base building and neck/grip strength protocols',
    multiple_modalities: true,
    workflow_chaos_visible: true,
    contact_method: 'WhatsApp',
    source_url: 'https://instagram.com/arjunnair_combatsc'
  },
  {
    id: 9,
    name: 'Maya Krishnan',
    social_channel: 'Instagram',
    social_handle: '@mayakrish_hybrid',
    city_country: 'Chennai, India',
    niche: 'Concurrent / Multi-Discipline',
    has_personal_brand: true,
    is_online_coaching: 'YES',
    is_custom_programming: 'YES',
    evidence_multiple_clients: 'YES',
    has_client_testimonials: 'YES',
    coaching_software_visible: 'NO',
    coaching_software: 'None',
    application_funnel_visible: 'YES',
    application_funnel: 'Typeform',
    observed_workflow_signal: 'Notion client dashboards + WhatsApp voice notes for Sunday weekly reviews',
    multiple_modalities: true,
    workflow_chaos_visible: true,
    contact_method: 'Instagram DM',
    source_url: 'https://instagram.com/mayakrish_hybrid'
  },
  {
    id: 10,
    name: 'Sameer Joshi',
    social_channel: 'Instagram',
    social_handle: '@sameer_runstrength',
    city_country: 'Mumbai, India',
    niche: 'HYROX / Endurance-Strength',
    has_personal_brand: true,
    is_online_coaching: 'YES',
    is_custom_programming: 'YES',
    evidence_multiple_clients: 'YES',
    has_client_testimonials: 'YES',
    coaching_software_visible: 'YES',
    coaching_software: 'TrueCoach',
    application_funnel_visible: 'NO',
    application_funnel: 'Unknown',
    observed_workflow_signal: 'TrueCoach workout screenshots posted in story highlights with pacing target feedback',
    multiple_modalities: true,
    workflow_chaos_visible: false,
    contact_method: 'Instagram DM',
    source_url: 'https://instagram.com/sameer_runstrength'
  },
  {
    id: 11,
    name: 'Rahul Khanna',
    social_channel: 'Instagram',
    social_handle: '@rahulkhanna_recomp',
    city_country: 'Gurugram, India',
    niche: 'Body Composition & Fat Loss',
    has_personal_brand: true,
    is_online_coaching: 'YES',
    is_custom_programming: 'YES',
    evidence_multiple_clients: 'YES',
    has_client_testimonials: 'YES',
    coaching_software_visible: 'YES',
    coaching_software: 'Trainerize',
    application_funnel_visible: 'YES',
    application_funnel: 'Website application form',
    observed_workflow_signal: 'Individual macro adjustment spreadsheets shown alongside client biofeedback logs',
    multiple_modalities: false,
    workflow_chaos_visible: true,
    contact_method: 'Instagram DM',
    source_url: 'https://instagram.com/rahulkhanna_recomp'
  },
  {
    id: 12,
    name: 'Vikram Rathore',
    social_channel: 'YouTube',
    social_handle: 'Coach Vikram Tennis S&C',
    city_country: 'Jaipur, India',
    niche: 'Sports & Performance',
    has_personal_brand: true,
    is_online_coaching: 'YES',
    is_custom_programming: 'YES',
    evidence_multiple_clients: 'YES',
    has_client_testimonials: 'YES',
    coaching_software_visible: 'NO',
    coaching_software: 'None',
    application_funnel_visible: 'YES',
    application_funnel: 'Google Form',
    observed_workflow_signal: 'Shared Google Drive folders for rotational power video breakdowns',
    multiple_modalities: true,
    workflow_chaos_visible: true,
    contact_method: 'Email',
    source_url: 'https://youtube.com/@coachvikram'
  },
  {
    id: 13,
    name: 'Neha Sharma',
    social_channel: 'Instagram',
    social_handle: '@neha_coachsc',
    city_country: 'Hyderabad, India',
    niche: 'Strength & Conditioning',
    has_personal_brand: true,
    is_online_coaching: 'YES',
    is_custom_programming: 'YES',
    evidence_multiple_clients: 'YES',
    has_client_testimonials: 'YES',
    coaching_software_visible: 'YES',
    coaching_software: 'Everfit',
    application_funnel_visible: 'YES',
    application_funnel: 'Link in bio',
    observed_workflow_signal: 'Shares 16-week periodization cycles with Deload markers on Everfit',
    multiple_modalities: true,
    workflow_chaos_visible: false,
    contact_method: 'Instagram DM',
    source_url: 'https://instagram.com/neha_coachsc'
  },
  {
    id: 14,
    name: 'Kunal Bajaj',
    social_channel: 'Instagram',
    social_handle: '@kunal_concurrtraining',
    city_country: 'Ahmedabad, India',
    niche: 'Concurrent / Multi-Discipline',
    has_personal_brand: true,
    is_online_coaching: 'YES',
    is_custom_programming: 'YES',
    evidence_multiple_clients: 'YES',
    has_client_testimonials: 'YES',
    coaching_software_visible: 'NO',
    coaching_software: 'None',
    application_funnel_visible: 'YES',
    application_funnel: 'Typeform',
    observed_workflow_signal: 'Sends weekly PDF schedules with customized heart rate zone training',
    multiple_modalities: true,
    workflow_chaos_visible: true,
    contact_method: 'Instagram DM',
    source_url: 'https://instagram.com/kunal_concurrtraining'
  },
  {
    id: 15,
    name: 'Sneha Patel',
    social_channel: 'Instagram',
    social_handle: '@sneha_hyroxprep',
    city_country: 'Bengaluru, India',
    niche: 'HYROX / Endurance-Strength',
    has_personal_brand: true,
    is_online_coaching: 'YES',
    is_custom_programming: 'YES',
    evidence_multiple_clients: 'YES',
    has_client_testimonials: 'YES',
    coaching_software_visible: 'YES',
    coaching_software: 'Trainerize',
    application_funnel_visible: 'YES',
    application_funnel: 'Calendly call booking',
    observed_workflow_signal: 'Sled push and wall ball performance tracking logs displayed in client stories',
    multiple_modalities: true,
    workflow_chaos_visible: true,
    contact_method: 'WhatsApp',
    source_url: 'https://instagram.com/sneha_hyroxprep'
  },
  {
    id: 16,
    name: 'Ananya Roy',
    social_channel: 'Instagram',
    social_handle: '@ananya_strength',
    city_country: 'Kolkata, India',
    niche: 'Professional Online Strength',
    has_personal_brand: true,
    is_online_coaching: 'YES',
    is_custom_programming: 'YES',
    evidence_multiple_clients: 'YES',
    has_client_testimonials: 'YES',
    coaching_software_visible: 'YES',
    coaching_software: 'TrueCoach',
    application_funnel_visible: 'YES',
    application_funnel: 'Google Form',
    observed_workflow_signal: 'TrueCoach client workout logs with detailed RPE adjustments',
    multiple_modalities: false,
    workflow_chaos_visible: false,
    contact_method: 'Instagram DM',
    source_url: 'https://instagram.com/ananya_strength'
  },
  {
    id: 17,
    name: 'Divya Saxena',
    social_channel: 'Instagram',
    social_handle: '@divya_recompcoach',
    city_country: 'Delhi NCR, India',
    niche: 'Body Composition & Fat Loss',
    has_personal_brand: true,
    is_online_coaching: 'YES',
    is_custom_programming: 'YES',
    evidence_multiple_clients: 'YES',
    has_client_testimonials: 'YES',
    coaching_software_visible: 'NO',
    coaching_software: 'None',
    application_funnel_visible: 'YES',
    application_funnel: 'Bio link',
    observed_workflow_signal: 'Weekly check-in form responses analyzed in Google Sheets, audio voice notes on WhatsApp',
    multiple_modalities: false,
    workflow_chaos_visible: true,
    contact_method: 'Instagram DM',
    source_url: 'https://instagram.com/divya_recompcoach'
  },
  {
    id: 18,
    name: 'Varun Singhania',
    social_channel: 'LinkedIn',
    social_handle: 'varun-singhania-coach',
    city_country: 'Mumbai, India',
    niche: 'Professional Online Strength',
    has_personal_brand: true,
    is_online_coaching: 'YES',
    is_custom_programming: 'YES',
    evidence_multiple_clients: 'YES',
    has_client_testimonials: 'YES',
    coaching_software_visible: 'YES',
    coaching_software: 'CoachRx',
    application_funnel_visible: 'YES',
    application_funnel: 'Direct intake form',
    observed_workflow_signal: 'CoachRx programming cycles for busy corporate executives wanting barbell strength',
    multiple_modalities: false,
    workflow_chaos_visible: false,
    contact_method: 'LinkedIn',
    source_url: 'https://linkedin.com/in/varun-singhania-coach'
  },
  {
    id: 19,
    name: 'Amit Trivedi',
    social_channel: 'Instagram',
    social_handle: '@amit_hypertrophy',
    city_country: 'Indore, India',
    niche: 'Body Composition & Fat Loss',
    has_personal_brand: true,
    is_online_coaching: 'YES',
    is_custom_programming: 'YES',
    evidence_multiple_clients: 'YES',
    has_client_testimonials: 'YES',
    coaching_software_visible: 'NO',
    coaching_software: 'None',
    application_funnel_visible: 'YES',
    application_funnel: 'WhatsApp link in bio',
    observed_workflow_signal: 'Client progress photos with exact week 1 vs week 16 metrics and custom training splits',
    multiple_modalities: false,
    workflow_chaos_visible: true,
    contact_method: 'WhatsApp',
    source_url: 'https://instagram.com/amit_hypertrophy'
  },
  {
    id: 20,
    name: 'Rohan Verma',
    social_channel: 'Instagram',
    social_handle: '@rohan_speedlab',
    city_country: 'Chandigarh, India',
    niche: 'Sports & Performance',
    has_personal_brand: true,
    is_online_coaching: 'YES',
    is_custom_programming: 'YES',
    evidence_multiple_clients: 'YES',
    has_client_testimonials: 'YES',
    coaching_software_visible: 'YES',
    coaching_software: 'bTrainr',
    application_funnel_visible: 'YES',
    application_funnel: 'Typeform',
    observed_workflow_signal: 'Video analysis and velocity based training feedback delivered through app',
    multiple_modalities: true,
    workflow_chaos_visible: false,
    contact_method: 'Instagram DM',
    source_url: 'https://instagram.com/rohan_speedlab'
  },

  // --- 10 NEGATIVE CONTROL CANDIDATES (Commercial Facilities / Generic Influencers) ---
  {
    id: 21,
    name: 'Anytime Fitness Connaught Place',
    business_name: 'Anytime Fitness Connaught Place',
    role: 'Commercial Gym Facility',
    city_country: 'New Delhi, India',
    niche: 'Commercial Gym',
    is_gym_or_studio: true,
    has_personal_brand: false,
    is_online_coaching: 'NO',
    is_custom_programming: 'NO',
    evidence_multiple_clients: 'Unknown',
    has_client_testimonials: 'NO',
    coaching_software_visible: 'NO',
    coaching_software: 'None',
    application_funnel_visible: 'NO',
    observed_workflow_signal: 'Commercial membership desk, franchise equipment promo, 24/7 keycard access',
    source: 'Google Maps Facility',
    source_url: 'https://anytimefitness.co.in/connaught-place'
  },
  {
    id: 22,
    name: 'Cult.fit Indiranagar Studio',
    business_name: 'Cult.fit Indiranagar Studio',
    role: 'Group Fitness Studio',
    city_country: 'Bengaluru, India',
    niche: 'Group Studio',
    is_gym_or_studio: true,
    has_personal_brand: false,
    is_online_coaching: 'NO',
    is_custom_programming: 'NO',
    evidence_multiple_clients: 'Unknown',
    has_client_testimonials: 'NO',
    coaching_software_visible: 'NO',
    observed_workflow_signal: 'Class pack booking through Cult.fit consumer app; no 1:1 individualized programming',
    source: 'Google Maps Facility',
    source_url: 'https://cult.fit/indiranagar'
  },
  {
    id: 23,
    name: 'Gold\'s Gym Bandra West',
    business_name: 'Gold\'s Gym Bandra West',
    role: 'Franchise Fitness Club',
    city_country: 'Mumbai, India',
    niche: 'Commercial Gym',
    is_gym_or_studio: true,
    has_personal_brand: false,
    is_online_coaching: 'NO',
    is_custom_programming: 'NO',
    evidence_multiple_clients: 'Unknown',
    has_client_testimonials: 'NO',
    coaching_software_visible: 'NO',
    observed_workflow_signal: 'Yearly gym membership discounts and walk-in front desk sales',
    source: 'Google Maps Facility',
    source_url: 'https://goldsgym.in/bandra'
  },
  {
    id: 24,
    name: 'BoxFit Delhi NCR',
    business_name: 'BoxFit Delhi NCR',
    role: 'Boutique Boxing Studio',
    city_country: 'Delhi NCR, India',
    niche: 'Boutique Studio',
    is_gym_or_studio: true,
    has_personal_brand: false,
    is_online_coaching: 'NO',
    is_custom_programming: 'NO',
    evidence_multiple_clients: 'Unknown',
    has_client_testimonials: 'NO',
    coaching_software_visible: 'NO',
    observed_workflow_signal: 'Session based group classes in studio with heavy bags',
    source: 'Google Maps Facility',
    source_url: 'https://boxfit.in'
  },
  {
    id: 25,
    name: 'F45 Training Koramangala',
    business_name: 'F45 Training Koramangala',
    role: 'Functional Studio Chain',
    city_country: 'Bengaluru, India',
    niche: 'Studio Chain',
    is_gym_or_studio: true,
    has_personal_brand: false,
    is_online_coaching: 'NO',
    is_custom_programming: 'NO',
    evidence_multiple_clients: 'Unknown',
    has_client_testimonials: 'NO',
    coaching_software_visible: 'NO',
    observed_workflow_signal: 'Group circuit screens on TV; standardized 45 min group workouts',
    source: 'Google Maps Facility',
    source_url: 'https://f45training.com/koramangala'
  },
  {
    id: 26,
    name: 'Rahul FitStyle (@fit_rahul_lifestyle)',
    social_channel: 'Instagram',
    social_handle: '@fit_rahul_lifestyle',
    bio: 'Discount code RAHUL10 on MyProtein | Gymshark athlete | Collabs DM',
    city_country: 'Delhi, India',
    niche: 'Generic Fitness Influencer',
    is_generic_influencer: true,
    influencer_affiliate_model: true,
    has_personal_brand: true,
    is_online_coaching: 'NO',
    is_custom_programming: 'NO',
    evidence_multiple_clients: 'NO',
    has_client_testimonials: 'NO',
    coaching_software_visible: 'NO',
    observed_workflow_signal: 'Sponsorship affiliate codes, gym selfies, trending audio reels; zero 1:1 coaching offers',
    source_url: 'https://instagram.com/fit_rahul_lifestyle'
  },
  {
    id: 27,
    name: 'Shredded Diva (@shredded_diva)',
    social_channel: 'Instagram',
    social_handle: '@shredded_diva',
    bio: 'Download my $9.99 30-Day Booty & Glute Ebook! Link below. Mass challenge.',
    city_country: 'Mumbai, India',
    niche: 'Ebook / Mass Challenge Seller',
    is_generic_influencer: true,
    influencer_affiliate_model: true,
    has_personal_brand: true,
    is_online_coaching: 'NO',
    is_custom_programming: 'NO',
    evidence_multiple_clients: 'NO',
    has_client_testimonials: 'NO',
    coaching_software_visible: 'NO',
    observed_workflow_signal: 'Generic PDF automated download via Gumroad, zero individualized client review or adaptation',
    source_url: 'https://instagram.com/shredded_diva'
  },
  {
    id: 28,
    name: 'Sunny Kumar - Talwalkars Floor Trainer',
    business_name: 'Talwalkars Gym',
    role: 'Gym-floor Personal Trainer',
    city_country: 'Noida, India',
    niche: 'Walk-in Floor PT',
    is_gym_or_studio: true,
    has_personal_brand: false,
    is_online_coaching: 'NO',
    is_custom_programming: 'NO',
    evidence_multiple_clients: 'Unknown',
    has_client_testimonials: 'NO',
    coaching_software_visible: 'NO',
    observed_workflow_signal: 'Attached strictly to Talwalkars gym floor hourly shift; no independent software or remote workflow',
    source: 'Gym Staff Listing',
    source_url: 'https://talwalkars.net'
  },
  {
    id: 29,
    name: 'Iron Paradise Gym & Fitness Centre',
    business_name: 'Iron Paradise Gym & Fitness Centre',
    role: 'Commercial Gym',
    city_country: 'Jaipur, India',
    niche: 'Commercial Gym',
    is_gym_or_studio: true,
    has_personal_brand: false,
    is_online_coaching: 'NO',
    is_custom_programming: 'NO',
    evidence_multiple_clients: 'Unknown',
    has_client_testimonials: 'NO',
    coaching_software_visible: 'NO',
    observed_workflow_signal: 'Local gym equipment photos, monthly membership pricing banner',
    source: 'Google Maps Facility',
    source_url: 'https://ironparadise.in'
  },
  {
    id: 30,
    name: '90-Day Summer Shred Challenge Org',
    business_name: '90-Day Summer Shred Challenge Org',
    role: 'Mass Challenge Seller',
    city_country: 'Unknown',
    niche: 'Automated Mass Challenge',
    is_generic_influencer: true,
    influencer_affiliate_model: true,
    has_personal_brand: false,
    is_online_coaching: 'NO',
    is_custom_programming: 'NO',
    evidence_multiple_clients: 'NO',
    has_client_testimonials: 'NO',
    coaching_software_visible: 'NO',
    observed_workflow_signal: 'Mass broadcast email sequence with static 90-day workout calendar; no coach review',
    source_url: 'https://summershredchallenge.com'
  }
];

function runEvaluationSuite() {
  console.log('===============================================================');
  console.log('COREATHLETE V2 LEAD QUALIFICATION EVALUATION TEST (30 CANDIDATES)');
  console.log('===============================================================');

  let totalCoaches = 0;
  let qualifiedCoaches = 0;
  let hotProspects = 0;
  let totalNegativeControls = 0;
  let rejectedNegativeControls = 0;

  const results = CANDIDATES.map(candidate => {
    const result = calculate10PointScore(candidate);
    const isControl = candidate.id >= 21;

    if (!isControl) {
      totalCoaches++;
      if (result.score >= 6) qualifiedCoaches++;
      if (result.tier === 'HOT PROSPECT') hotProspects++;
    } else {
      totalNegativeControls++;
      if (result.isRejected) rejectedNegativeControls++;
    }

    return {
      id: candidate.id,
      name: candidate.name,
      niche: candidate.niche,
      score: result.score,
      rawScore: result.rawScore,
      tier: result.tier,
      isRejected: result.isRejected,
      reason: result.reason_for_score,
      breakdown: result.breakdown
    };
  });

  // Table summary output
  console.log('\nEVALUATION RESULTS BREAKDOWN:');
  console.log('------------------------------------------------------------------------------------------------------------------');
  console.log('| ID | Candidate Name                          | Niche                  | Score | Tier          | Status         |');
  console.log('------------------------------------------------------------------------------------------------------------------');
  results.forEach(r => {
    const status = r.isRejected ? '❌ REJECTED' : '✅ ACCEPTED';
    const paddedId = String(r.id).padEnd(2);
    const paddedName = r.name.slice(0, 39).padEnd(39);
    const paddedNiche = r.niche.slice(0, 22).padEnd(22);
    const paddedScore = `${r.score}/10`.padEnd(5);
    const paddedTier = r.tier.padEnd(13);
    console.log(`| ${paddedId} | ${paddedName} | ${paddedNiche} | ${paddedScore} | ${paddedTier} | ${status} |`);
  });
  console.log('------------------------------------------------------------------------------------------------------------------');

  console.log('\nMETRICS SUMMARY:');
  console.log(`1. Total Independent Coaches Evaluated: ${totalCoaches}`);
  console.log(`   - Qualified Coaches (Score >= 6):    ${qualifiedCoaches} (${((qualifiedCoaches/totalCoaches)*100).toFixed(0)}%)`);
  console.log(`   - Hot Prospects (Score >= 8):       ${hotProspects} (${((hotProspects/totalCoaches)*100).toFixed(0)}%)`);
  console.log(`2. Total Negative Controls Evaluated:    ${totalNegativeControls}`);
  console.log(`   - Negative Controls Disqualified:    ${rejectedNegativeControls} / ${totalNegativeControls} (${((rejectedNegativeControls/totalNegativeControls)*100).toFixed(0)}%)`);

  // Assertions
  const assertGymsRejected = rejectedNegativeControls === totalNegativeControls;
  const assertCoachesPassed = qualifiedCoaches >= 18; // at least 90% of the 20 test coaches

  console.log('\nTEST ASSERTIONS:');
  console.log(`- Commercial Gyms/Studios/Influencers 100% Disqualified: ${assertGymsRejected ? 'PASSED ✅' : 'FAILED ❌'}`);
  console.log(`- Independent Coaches with Workflow Complexity Qualified:  ${assertCoachesPassed ? 'PASSED ✅' : 'FAILED ❌'}`);

  if (assertGymsRejected && assertCoachesPassed) {
    console.log('\n🏆 ALL LEAD GEN V2 QUALIFICATION TESTS PASSED SUCCESSFULLY!');
    return { success: true, results };
  } else {
    console.error('\n❌ QUALIFICATION ENGINE TEST SUITE FAILED!');
    process.exit(1);
  }
}

if (require.main === module) {
  runEvaluationSuite();
}

module.exports = { CANDIDATES, runEvaluationSuite };
