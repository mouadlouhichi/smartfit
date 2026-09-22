# Muscle Monster–Style Fitness App
## Complete Functional Requirements Specification (FRS)

**Document type:** Functional Requirements Specification  
**Version:** 1.0  
**Status:** Product / Engineering Baseline  
**Audience:** Product, UX/UI, Engineering, QA, Data, Content, Operations  
**Platform:** iOS, Android, Web Admin  
**Primary audience:** Beginner fitness users  
**Document language:** English

---

# 1. Document Purpose

This document defines the functional behavior of a beginner-focused fitness application inspired by the feature model of modern workout-planner applications such as Muscle Monster.

It is written as an implementation-oriented specification. It defines:

- What the application does
- What users can see and do
- How the application behaves
- What data must be stored
- How personalization works
- How workouts are generated and executed
- How progress is calculated
- How subscriptions work
- How administrators manage content
- How edge cases and errors are handled
- What must be tested before release

This document is a functional specification, not a visual clone specification. Branding, copyrighted assets, proprietary algorithms, and exact UI layouts must be independently designed.

---

# 2. Product Vision

The product is a digital personal trainer for people who want to start or maintain structured exercise.

The application should reduce the complexity of deciding:

1. What should I train?
2. Which exercises should I perform?
3. How many sets and repetitions should I do?
4. How much should I rest?
5. What equipment can I use?
6. When should I train?
7. Am I progressing?
8. What should I do next?

The core experience is:

> **Assess → Personalize → Plan → Train → Track → Adapt → Progress**

---

# 3. Product Objectives

## 3.1 Primary objectives

- Make fitness accessible to beginners.
- Generate personalized workouts.
- Provide clear exercise instructions.
- Guide users through workouts in real time.
- Track completed training.
- Track body-weight and physical progress.
- Encourage consistency.
- Adapt training to user performance.
- Support both home and gym training.
- Support equipment/no-equipment scenarios.
- Provide a premium subscription model.

## 3.2 Secondary objectives

- Build long-term user engagement.
- Increase workout completion rate.
- Increase weekly active users.
- Convert free users to premium users.
- Provide content and analytics tools for administrators.

---

# 4. Product Scope

## 4.1 In scope

- Account management
- User onboarding
- Fitness assessment
- Goals
- Workout generation
- Exercise library
- Workout plans
- Workout player
- Exercise substitution
- Workout modification
- Rest timer
- Set tracking
- Weight/repetition tracking
- Workout history
- Progress tracking
- Body measurements
- Training calendar
- Notifications
- Streaks
- Challenges
- Achievements
- Subscription
- Payment management
- Health integrations
- Wearable integrations
- Admin portal
- Content management
- Analytics
- User support

## 4.2 Out of scope for initial release

Unless explicitly enabled as a product phase:

- Medical diagnosis
- Medical treatment
- Emergency response
- Professional clinical rehabilitation
- Automated diagnosis from photographs
- Prescription of medication
- Fully autonomous medical advice

The product must clearly distinguish fitness guidance from medical advice.

---

# 5. User Roles

## 5.1 Guest

A user who has not authenticated.

Capabilities:

- View marketing pages
- View selected public exercises
- View selected example workouts
- Start registration
- Log in

Restrictions:

- Cannot permanently store workout history.
- Cannot access personalized plans.
- Cannot access premium features.

## 5.2 Free User

Authenticated user without an active premium subscription.

Capabilities:

- Complete onboarding
- Receive limited personalized workouts
- Execute free workouts
- Track basic progress
- Track weight
- Maintain basic history
- Access selected exercise library
- Participate in selected challenges

Restrictions:

- Premium plans/content may be locked.
- Advanced analytics may be locked.
- Advanced personalization may be limited.

## 5.3 Premium User

Authenticated user with an active subscription.

Capabilities:

- Full workout library
- Full exercise library
- Advanced personalized plans
- Advanced progress analytics
- Advanced workout customization
- Premium challenges
- Advanced tracking
- Premium integrations where supported

## 5.4 Administrator

Capabilities:

- Manage users
- Manage exercises
- Manage workouts
- Manage plans
- Manage challenges
- Manage subscriptions
- Manage content
- Manage notifications
- View analytics
- Handle support cases

## 5.5 Content Manager

Capabilities:

- Create/edit exercises
- Upload videos/images
- Create workout templates
- Create challenges
- Publish/unpublish content

Restrictions:

- No financial administration unless explicitly granted.

## 5.6 Support Agent

Capabilities:

- Search users
- View support-relevant account information
- Review subscription state
- Review technical logs
- Respond to support requests

Restrictions:

- No password visibility
- No direct access to payment credentials
- No unrestricted administrative changes

---

# 6. Core User Journey

## 6.1 First-time user

1. Open application.
2. View welcome screen.
3. Select "Get Started".
4. Create account or continue with supported authentication.
5. Accept Terms and Privacy Policy.
6. Complete onboarding.
7. Select fitness goal.
8. Select experience level.
9. Enter physical information.
10. Select training location.
11. Select available equipment.
12. Select preferred training frequency.
13. Select available training duration.
14. Select target muscle groups.
15. Complete optional fitness assessment.
16. Generate initial plan.
17. Display first recommended workout.
18. Start workout.
19. Complete workout.
20. Record results.
21. Show completion summary.
22. Update progress.
23. Schedule next workout.
24. Send optional reminder.

---

# 7. Navigation

## 7.1 Primary mobile navigation

Recommended tabs:

1. Home
2. Plan
3. Workout
4. Progress
5. Profile

## 7.2 Home

Contains:

- Greeting
- Today's workout
- Workout CTA
- Current streak
- Weekly goal
- Progress snapshot
- Next scheduled workout
- Recommended content
- Challenges
- Premium promotion when applicable

## 7.3 Plan

Contains:

- Current training plan
- Calendar
- Upcoming sessions
- Completed sessions
- Rest days
- Plan settings
- Modify plan

## 7.4 Workout

Contains:

- Active workout
- Exercise library
- Saved workouts
- Custom workouts

## 7.5 Progress

Contains:

- Workout statistics
- Weight
- Measurements
- Strength
- Training consistency
- Progress charts

## 7.6 Profile

Contains:

- Personal information
- Goals
- Preferences
- Equipment
- Subscription
- Notifications
- Integrations
- Privacy
- Help
- Logout

---

# 8. Authentication

## FR-AUTH-001 Registration

The system shall allow registration using:

- Email/password
- Apple Sign-In where supported
- Google Sign-In where supported

Required information:

- Email
- Password for password-based registration
- Consent to Terms
- Consent to Privacy Policy

## FR-AUTH-002 Email verification

If enabled, newly registered users shall receive a verification email.

States:

- Unverified
- Verified
- Verification expired
- Verification resent

## FR-AUTH-003 Login

Users shall be able to authenticate using their registered credentials.

## FR-AUTH-004 Password reset

User flow:

1. Enter email.
2. Receive reset message.
3. Open reset link.
4. Enter new password.
5. Confirm password.
6. Return to login.

## FR-AUTH-005 Session management

The system shall:

- Maintain authenticated sessions.
- Refresh sessions securely.
- Expire sessions according to security policy.
- Support logout from current device.
- Optionally support logout from all devices.

## FR-AUTH-006 Account deletion

Users shall be able to request account deletion.

Deletion behavior shall:

- Confirm intent.
- Explain consequences.
- Remove or anonymize applicable personal data.
- Preserve legally required transaction records where applicable.

---

# 9. Onboarding

Onboarding is a required personalization workflow.

## FR-ONB-001 Welcome

Display:

- Product value proposition
- Get Started CTA
- Login CTA

## FR-ONB-002 Fitness goal

User selects one or more goals.

Supported goals:

- Build muscle
- Increase strength
- Lose body fat
- Lose weight
- Improve fitness
- Improve endurance
- Improve mobility
- Improve flexibility
- Improve consistency
- General health/fitness

The system shall allow one primary goal.

## FR-ONB-003 Experience level

Options:

- Beginner
- Intermediate
- Advanced

Beginner selection shall influence:

- Exercise complexity
- Training volume
- Exercise selection
- Rest duration
- Instruction level
- Progression speed

## FR-ONB-004 Physical information

Fields:

- Age
- Sex, if the product requires it for its calculations
- Height
- Weight

Units:

- kg / lb
- cm / ft-in

The user shall be able to change units later.

## FR-ONB-005 Training location

Options:

- Home
- Gym
- Outdoor
- Mixed

## FR-ONB-006 Equipment

Selectable equipment:

- None
- Bodyweight
- Dumbbells
- Barbell
- Bench
- Kettlebell
- Resistance bands
- Pull-up bar
- Cable machine
- Machines
- Power rack
- Other supported equipment

The user shall be able to select multiple items.

## FR-ONB-007 Training frequency

Options:

- 1 day/week
- 2 days/week
- 3 days/week
- 4 days/week
- 5 days/week
- 6 days/week
- 7 days/week

Recommended beginner defaults should favor manageable frequency rather than maximum frequency.

## FR-ONB-008 Session duration

Options:

- 10–15 minutes
- 15–30 minutes
- 30–45 minutes
- 45–60 minutes
- 60+ minutes

## FR-ONB-009 Target muscles

Selectable:

- Full body
- Chest
- Back
- Shoulders
- Biceps
- Triceps
- Forearms
- Core
- Glutes
- Quadriceps
- Hamstrings
- Calves

## FR-ONB-010 Schedule

User may select preferred:

- Days
- Start time
- Time zone

## FR-ONB-011 Reminder preference

User may enable/disable workout reminders.

## FR-ONB-012 Onboarding completion

The system shall not generate a personalized plan until all mandatory onboarding fields are valid.

---

# 10. Fitness Assessment

## FR-ASSESS-001 Assessment

The application may provide an optional beginner fitness assessment.

Possible components:

- Push-up capability
- Squat capability
- Plank duration
- Mobility questions
- Training history
- Exercise familiarity

The assessment must avoid presenting medical conclusions.

## FR-ASSESS-002 Result

The system calculates a fitness baseline.

Example levels:

- Foundation
- Beginner
- Developing

These are product classifications, not medical diagnoses.

## FR-ASSESS-003 Reassessment

User may repeat assessment after a configurable period.

---

# 11. Goals

## FR-GOAL-001 Goal creation

A user may create:

- Primary goal
- Secondary goal

## FR-GOAL-002 Goal parameters

Possible parameters:

- Target weight
- Target date
- Training frequency
- Weekly activity target
- Strength target
- Consistency target

## FR-GOAL-003 Goal progress

The system shall display:

- Current value
- Target value
- Percentage progress where mathematically appropriate
- Trend
- Recent activity

## FR-GOAL-004 Goal modification

Changing a major goal shall trigger a plan review.

---

# 12. Exercise Library

The exercise library is the central content repository.

## FR-EX-001 Exercise record

Each exercise shall contain:

- Exercise ID
- Name
- Description
- Instructions
- Primary muscle
- Secondary muscles
- Equipment
- Difficulty
- Exercise type
- Movement pattern
- Video
- Images
- Safety notes
- Common mistakes
- Tags
- Status
- Created date
- Updated date

## FR-EX-002 Exercise types

Examples:

- Strength
- Cardio
- Mobility
- Flexibility
- Warm-up
- Cool-down
- Core
- Bodyweight
- Machine
- Free-weight

## FR-EX-003 Difficulty

Values:

- Beginner
- Intermediate
- Advanced

## FR-EX-004 Equipment filtering

Users shall filter by:

- No equipment
- Dumbbell
- Barbell
- Kettlebell
- Bands
- Machines
- Cable
- Bench
- Other

## FR-EX-005 Muscle filtering

Users shall filter by muscle group.

## FR-EX-006 Search

Search shall support:

- Exercise name
- Muscle
- Equipment
- Tags

## FR-EX-007 Exercise detail

Exercise detail screen shall display:

1. Name
2. Video/image
3. Target muscle
4. Equipment
5. Difficulty
6. Instructions
7. Sets/reps recommendation
8. Rest recommendation
9. Common mistakes
10. Favorite button

## FR-EX-008 Favorites

Users may favorite/unfavorite exercises.

## FR-EX-009 Exercise replacement

The system shall suggest alternatives with compatible:

- Muscle target
- Movement pattern
- Equipment
- Difficulty

---

# 13. Workout Library

## FR-WLIB-001 Workout record

Each workout shall contain:

- Workout ID
- Name
- Description
- Goal
- Difficulty
- Duration
- Equipment
- Muscle groups
- Exercises
- Sets
- Repetitions
- Rest
- Estimated calories where available
- Premium status
- Publication status

## FR-WLIB-002 Workout categories

Examples:

- Full body
- Upper body
- Lower body
- Push
- Pull
- Legs
- Core
- Abs
- Strength
- Muscle building
- Fat loss
- Mobility
- Flexibility
- Home
- Gym
- No equipment

## FR-WLIB-003 Workout discovery

Users shall be able to:

- Search
- Filter
- Sort
- Favorite
- Preview
- Start

---

# 14. Personalized Workout Generator

## FR-GEN-001 Plan generation

The system shall generate workouts based on:

- Goal
- Experience
- Equipment
- Location
- Available time
- Training frequency
- Target muscles
- Workout history
- Recovery constraints
- Previously completed exercises

## FR-GEN-002 Exercise selection

The generator shall exclude:

- Unsupported equipment
- Exercises above configured difficulty
- Exercises explicitly excluded by user
- Exercises unavailable/unpublished

## FR-GEN-003 Muscle balance

The system shall prevent excessive repeated training of the same muscle group according to configurable recovery rules.

## FR-GEN-004 Workout duration

Generated workout duration shall target the user's selected session duration.

## FR-GEN-005 Progressive overload

Where applicable, future workouts may increase:

- Repetitions
- Sets
- Load
- Time
- Difficulty

The system shall use conservative progression for beginners.

## FR-GEN-006 Deload/recovery

The system may reduce training demand after configured training cycles or when performance/recovery indicators justify it.

## FR-GEN-007 Regeneration

User may regenerate a workout.

The system shall explain that regenerating can change the session.

---

# 15. Training Plans

## FR-PLAN-001 Plan creation

A plan contains:

- Plan ID
- Name
- Goal
- Duration
- Frequency
- Difficulty
- Sessions
- Rest days
- Progression rules

## FR-PLAN-002 Plan duration

Examples:

- 2 weeks
- 4 weeks
- 8 weeks
- 12 weeks

## FR-PLAN-003 Weekly structure

Each week contains:

- Training days
- Rest days
- Optional sessions

## FR-PLAN-004 Plan modification

User can:

- Change training days
- Change workout duration
- Change equipment
- Replace workouts
- Pause plan
- Restart plan

## FR-PLAN-005 Missed workout

If a workout is missed:

- Do not automatically mark it completed.
- Offer reschedule.
- Avoid forcing unnecessary double sessions.
- Recalculate future schedule if required.

---

# 16. Workout Player

The workout player is a primary product screen.

## FR-PLAYER-001 Start workout

When the user selects Start:

1. Create workout session.
2. Load first exercise.
3. Start workout timer.
4. Display exercise instructions.

## FR-PLAYER-002 Exercise screen

Display:

- Exercise name
- Demonstration video/image
- Target muscle
- Current set
- Target reps/time
- Previous performance
- Current weight
- Reps
- Rest
- Complete set button

## FR-PLAYER-003 Set completion

On completion:

- Store actual reps.
- Store actual weight.
- Store completion timestamp.
- Calculate set volume where applicable.
- Start rest timer.

## FR-PLAYER-004 Rest timer

Features:

- Start automatically
- Pause
- Skip
- Add time
- Subtract time
- Notification when finished

## FR-PLAYER-005 Next exercise

After final set:

- Show completion state.
- Offer next exercise.

## FR-PLAYER-006 Pause workout

User may pause.

Paused state shall preserve:

- Current exercise
- Current set
- Timer state
- Logged sets

## FR-PLAYER-007 Resume workout

User resumes exactly where they stopped.

## FR-PLAYER-008 Skip exercise

User may skip an exercise.

The system shall ask for confirmation.

## FR-PLAYER-009 Replace exercise

User may replace an exercise.

The system shall show compatible alternatives.

## FR-PLAYER-010 Finish early

User may end the workout before completion.

The system shall display:

- Completed exercises
- Completed sets
- Duration
- Completion percentage

## FR-PLAYER-011 Workout completion

A completed workout shall create a permanent workout history record.

---

# 17. Exercise Set Tracking

Each set may contain:

- Target repetitions
- Actual repetitions
- Target weight
- Actual weight
- Duration
- RPE where enabled
- Notes

## FR-SET-001 Previous performance

Before a set, display the user's previous performance for the same exercise when available.

## FR-SET-002 RPE

Optional RPE scale:

- 1–10

## FR-SET-003 Notes

User can record notes such as:

- Felt easy
- Felt difficult
- Equipment unavailable
- Pain/discomfort

The product shall not interpret notes as medical diagnoses.

---

# 18. Workout Adaptation

## FR-ADAPT-001 Performance adaptation

If the user consistently exceeds the target comfortably, the next workout may increase difficulty.

## FR-ADAPT-002 Underperformance

If the user repeatedly cannot complete targets, the system may reduce:

- Load
- Repetitions
- Sets
- Difficulty

## FR-ADAPT-003 Exercise substitution

Repeatedly skipped exercises may be suggested for replacement.

## FR-ADAPT-004 User control

Automatic adaptation shall not remove the user's ability to manually modify workouts.

---

# 19. Custom Workouts

## FR-CUSTOM-001 Create

User selects:

- Workout name
- Exercises
- Sets
- Reps
- Weight
- Rest

## FR-CUSTOM-002 Save

Workout is stored under user's account.

## FR-CUSTOM-003 Duplicate

User may duplicate an existing custom workout.

## FR-CUSTOM-004 Edit

User may modify a saved workout.

## FR-CUSTOM-005 Delete

User may delete a custom workout.

---

# 20. Workout History

## FR-HIST-001 History list

Display:

- Date
- Workout name
- Duration
- Exercises
- Completion status

## FR-HIST-002 History detail

Display:

- Exercises
- Sets
- Reps
- Weights
- Volume
- Duration
- Calories if available
- Notes

## FR-HIST-003 Filtering

Filter by:

- Date
- Workout
- Muscle group
- Exercise

---

# 21. Weight Tracking

## FR-WEIGHT-001 Record weight

User may record:

- Weight
- Date
- Optional time

## FR-WEIGHT-002 Weight history

Display graph and history.

## FR-WEIGHT-003 Weight trend

The system may display a smoothed trend to avoid overreacting to normal daily fluctuations.

## FR-WEIGHT-004 Editing

Users can edit or delete incorrect measurements.

---

# 22. Body Measurements

Optional measurements:

- Waist
- Chest
- Arms
- Thighs
- Hips
- Calves
- Neck

Users may enter measurements manually.

The application shall show trends without presenting them as medical conclusions.

---

# 23. Progress Dashboard

## FR-PROG-001 Overview

Display:

- Workouts completed
- Weekly consistency
- Current streak
- Total training time
- Weight trend
- Strength trend
- Goal progress

## FR-PROG-002 Strength progress

Track exercise-specific:

- Best weight
- Best repetitions
- Estimated 1RM where supported
- Total volume

## FR-PROG-003 Volume

For strength exercises:

`Volume = Σ(weight × repetitions)`

For bodyweight exercises, volume may use repetitions without a load value.

## FR-PROG-004 Charts

Supported charts:

- Weight
- Workout frequency
- Training volume
- Exercise performance
- Measurements
- Goal progress

---

# 24. Training Calendar

## FR-CAL-001 Calendar

Display:

- Completed workouts
- Scheduled workouts
- Rest days
- Missed workouts
- Challenges

## FR-CAL-002 Schedule workout

User can schedule a workout.

## FR-CAL-003 Reschedule

User can move a future workout.

## FR-CAL-004 Rest day

User can manually designate a rest day.

---

# 25. Reminders & Notifications

Notification types:

- Workout reminder
- Upcoming workout
- Missed workout
- Streak reminder
- Challenge reminder
- Plan milestone
- Subscription reminder
- Product announcements

Users can enable/disable each category where supported.

## FR-NOTIF-001 Quiet hours

User may define quiet hours.

## FR-NOTIF-002 Time zone

Scheduled notifications shall use the user's configured time zone.

---

# 26. Streaks

## FR-STREAK-001 Workout streak

A streak increments when the user completes a qualifying workout.

## FR-STREAK-002 Streak break

The system breaks the streak according to configured rules.

## FR-STREAK-003 Rest days

Planned rest days should not necessarily break a plan consistency streak.

## FR-STREAK-004 Display

Show:

- Current streak
- Longest streak
- Weekly consistency

---

# 27. Challenges

## FR-CHAL-001 Challenge structure

A challenge contains:

- Name
- Description
- Start date
- End date
- Rules
- Goal
- Reward
- Eligibility
- Content

## FR-CHAL-002 Participation

User can:

- Join
- Leave where allowed
- Track progress
- Complete challenge

## FR-CHAL-003 Examples

- 7-day consistency challenge
- 21-day beginner challenge
- Full-body challenge
- Core challenge
- Strength challenge

---

# 28. Achievements

Possible achievements:

- First workout
- 5 workouts
- 10 workouts
- First week completed
- 7-day streak
- 30-day streak
- First strength milestone
- Challenge completed

Achievement records shall contain:

- ID
- Name
- Description
- Icon
- Requirement
- Unlock date

---

# 29. Motivation

Home screen may display:

- Encouraging messages
- Progress milestones
- Streak status
- Weekly target
- Next workout
- Challenge progress

Messages must avoid shaming users for missed workouts.

---

# 30. Health Integrations

## 30.1 Apple Health

Where available, the app may support:

- Workout data
- Activity data
- Weight
- Steps
- Calories

The user must explicitly grant permissions.

## 30.2 Health Connect

Android implementation may support Health Connect where technically available.

## 30.3 Permission management

The user must be able to:

- Grant permissions
- Deny permissions
- Revoke access through supported settings
- View what data is synchronized

---

# 31. Wearables

Where supported:

- Apple Watch
- Wear OS or other supported wearable platforms

Potential capabilities:

- Start workout
- View current exercise
- View timer
- Record workout
- View heart-rate data if permission is granted
- Sync completed workout

The mobile application remains the source of truth unless otherwise specified.

---

# 32. Audio / Voice Guidance

## FR-VOICE-001

During workouts the system may announce:

- Exercise name
- Set start
- Rest start
- Rest completion
- Workout completion

## FR-VOICE-002

User can enable/disable voice guidance.

## FR-VOICE-003

Supported voices/languages shall be configurable.

---

# 33. Search

Global search may search:

- Exercises
- Workouts
- Plans
- Challenges

Search should support partial matches and normalized text.

---

# 34. Favorites

Users can favorite:

- Exercises
- Workouts
- Plans

Favorites are stored per account.

---

# 35. User Profile

Profile contains:

- Name
- Email
- Age
- Height
- Weight
- Units
- Goals
- Experience
- Equipment
- Training location
- Training days
- Preferred time
- Notification preferences

Users can edit these values.

Major changes may trigger plan recalculation.

---

# 36. Subscription

## 36.1 Plans

Recommended model:

- Free
- Premium Monthly
- Premium Annual

Optional:

- Lifetime purchase

## 36.2 Free trial

If offered:

- Trial duration configurable
- Eligibility configurable
- Automatic conversion behavior clearly displayed

## 36.3 Paywall

Paywall shall explain:

- Premium benefits
- Price
- Billing frequency
- Trial terms
- Renewal behavior
- Cancellation instructions

## 36.4 Purchase

Mobile purchases should use the platform's supported in-app purchase system where required.

## 36.5 Restore purchases

User can restore purchases.

## 36.6 Subscription state

States:

- None
- Trial
- Active
- Grace period
- Billing retry
- Expired
- Cancelled
- Refunded

---

# 37. Premium Feature Gating

Each feature shall have a configurable access level:

- Free
- Premium
- Admin only

Examples of possible premium features:

- Unlimited personalized plans
- Full exercise library
- Advanced analytics
- Advanced customization
- Premium challenges
- Advanced progression

The exact commercial configuration shall be controlled by the product team.

---

# 38. Payments

Payment system shall:

- Never store raw card information unless explicitly required and securely compliant.
- Use approved payment providers/platform billing.
- Record transaction identifiers.
- Record subscription status.
- Support purchase verification.
- Handle refunds and cancellations.

---

# 39. Admin Dashboard

## 39.1 Dashboard

Display:

- Total users
- New users
- Active users
- Workout sessions
- Completed workouts
- Subscription count
- Trial conversions
- Churn
- Content usage

## 39.2 User management

Admin can:

- Search users
- View account status
- View subscription state
- View workout statistics
- Disable account
- Restore account
- Handle support issues

Admins must not see passwords.

---

# 40. Exercise Content Management

Admin/content manager can:

- Create exercise
- Edit exercise
- Archive exercise
- Publish exercise
- Unpublish exercise
- Upload media
- Assign muscles
- Assign equipment
- Set difficulty
- Add instructions
- Add safety notes
- Add tags

## Publication states

- Draft
- Review
- Published
- Archived

---

# 41. Workout Content Management

Admin can:

- Create workout
- Edit workout
- Duplicate workout
- Add exercises
- Remove exercises
- Reorder exercises
- Set sets/reps
- Set rest
- Set duration
- Assign goals
- Assign equipment
- Assign difficulty
- Publish/unpublish

---

# 42. Plan Content Management

Admin can define:

- Plan duration
- Weekly schedule
- Workouts
- Rest days
- Progression
- Difficulty
- Goal
- Equipment

---

# 43. Challenge Management

Admin can:

- Create challenge
- Configure dates
- Configure rules
- Configure rewards
- Publish/unpublish
- View participation
- View completion

---

# 44. Notification Management

Admin can create:

- Push notifications
- In-app announcements
- Promotional notifications
- Product announcements

Admin must be able to define audience segments.

---

# 45. Support

## FR-SUPPORT-001

User can contact support.

Fields:

- Category
- Subject
- Message
- Optional attachment

Categories:

- Account
- Subscription
- Workout
- Technical issue
- Content
- Other

## FR-SUPPORT-002

Support ticket states:

- Open
- In progress
- Waiting for user
- Resolved
- Closed

---

# 46. Analytics

Product analytics should measure:

## Acquisition

- Install
- Registration
- Onboarding start
- Onboarding completion

## Activation

- First workout
- First completed workout
- First plan
- First weight entry

## Engagement

- DAU
- WAU
- MAU
- Workouts/user
- Sessions/week
- Streak usage
- Challenge participation

## Retention

- D1
- D7
- D30

## Monetization

- Paywall views
- Trial starts
- Purchases
- Conversion
- Renewal
- Cancellation
- Refund

---

# 47. Recommended Analytics Events

Events should include:

- app_opened
- onboarding_started
- onboarding_completed
- goal_selected
- assessment_completed
- plan_generated
- workout_viewed
- workout_started
- exercise_started
- set_completed
- exercise_completed
- workout_paused
- workout_resumed
- workout_completed
- workout_abandoned
- exercise_replaced
- workout_regenerated
- weight_added
- measurement_added
- challenge_joined
- challenge_completed
- subscription_viewed
- trial_started
- subscription_started
- subscription_cancelled
- purchase_restored

Each event should include a minimal, privacy-conscious parameter set.

---

# 48. Recommendation Engine

The recommendation engine should consider:

## User inputs

- Goal
- Level
- Equipment
- Location
- Schedule
- Duration
- Muscle preference

## Historical signals

- Completed workouts
- Skipped exercises
- Replaced exercises
- Performance
- Workout frequency
- Recent muscle usage

## Recommendation constraints

- Equipment availability
- Exercise publication status
- Difficulty
- Training frequency
- Recovery rules
- Session duration

## Recommendation output

- Workout
- Exercises
- Sets
- Reps
- Rest
- Difficulty
- Estimated duration

---

# 49. Beginner-Specific Rules

For beginner users:

- Prefer simple compound movements.
- Avoid unnecessarily complex exercise variations.
- Provide detailed instructions.
- Show demonstrations before execution.
- Use manageable volume.
- Provide adequate rest.
- Explain terminology.
- Display previous performance only when available.
- Avoid assuming gym experience.
- Allow exercise substitution.
- Provide equipment alternatives.
- Avoid aggressive progression.

---

# 50. Safety & User Experience Rules

The application is a fitness product, not a medical diagnostic system.

## 50.1 Discomfort

If the user reports pain/discomfort:

- Stop or modify the exercise.
- Show a general safety message.
- Recommend seeking appropriate professional advice for persistent or serious symptoms.

## 50.2 Exercise warnings

Content managers may attach warnings to exercises.

## 50.3 Emergency situations

The application must not represent itself as an emergency service.

---

# 51. Offline Mode

The mobile application should support limited offline functionality.

Available offline:

- Downloaded workout
- Exercise instructions
- Cached media where licensing permits
- Workout execution
- Set logging
- Timers

When connectivity returns:

- Synchronize workout
- Synchronize progress
- Resolve conflicts

---

# 52. Synchronization

Each mutable record should have:

- ID
- Updated timestamp
- Version
- User ID

Conflict resolution should prioritize the most recent valid update, except for append-only workout events where duplicate prevention is required.

---

# 53. Data Model

Recommended entities:

## User

- id
- email
- name
- birthDate/age
- height
- weight
- sex if required
- level
- goal
- createdAt
- updatedAt

## UserPreference

- userId
- units
- location
- equipment
- workoutDuration
- workoutDays
- reminderTime
- notificationSettings

## Goal

- id
- userId
- type
- target
- startDate
- targetDate
- status

## Exercise

- id
- name
- description
- instructions
- difficulty
- type
- primaryMuscle
- secondaryMuscles
- equipment
- videoUrl
- imageUrl
- status

## Workout

- id
- name
- description
- difficulty
- goal
- duration
- equipment
- premium
- status

## WorkoutExercise

- workoutId
- exerciseId
- order
- sets
- reps
- duration
- rest
- notes

## TrainingPlan

- id
- userId
- templateId
- startDate
- endDate
- status

## PlanSession

- id
- planId
- date
- workoutId
- status

## WorkoutSession

- id
- userId
- workoutId
- startedAt
- completedAt
- duration
- status

## ExerciseSet

- id
- workoutSessionId
- exerciseId
- setNumber
- targetReps
- actualReps
- targetWeight
- actualWeight
- rest
- rpe

## BodyWeightEntry

- id
- userId
- value
- unit
- measuredAt

## Measurement

- id
- userId
- type
- value
- unit
- measuredAt

## Favorite

- id
- userId
- entityType
- entityId

## Challenge

- id
- name
- description
- startDate
- endDate
- status

## ChallengeParticipation

- challengeId
- userId
- progress
- status

## Achievement

- id
- name
- description
- rule

## UserAchievement

- userId
- achievementId
- unlockedAt

## Subscription

- id
- userId
- provider
- productId
- status
- startDate
- endDate
- renewalDate

## Notification

- id
- userId
- type
- title
- body
- scheduledAt
- sentAt
- status

## SupportTicket

- id
- userId
- category
- subject
- message
- status
- createdAt
- updatedAt

---

# 54. Business Rules

## BR-001

A workout can only be marked completed once.

## BR-002

A completed workout must contain at least one completed exercise or meet the configured completion threshold.

## BR-003

Skipped exercises do not count as completed sets.

## BR-004

Deleting an exercise from the content library must not destroy historical workout records.

## BR-005

Historical workout records must preserve the exercise name/version used at the time.

## BR-006

Unpublished workouts must not appear in new recommendations.

## BR-007

Premium content must be server-authorized where practical.

## BR-008

A user may only access their own private fitness records.

## BR-009

Changing equipment can trigger plan regeneration.

## BR-010

Changing primary goal can trigger plan regeneration.

## BR-011

Changing experience level can trigger plan review.

## BR-012

Changing training frequency can update the calendar.

## BR-013

A deleted account cannot authenticate after deletion is finalized.

---

# 55. Screen Inventory

## Public

1. Splash
2. Welcome
3. Login
4. Register
5. Forgot Password
6. Reset Password
7. Terms
8. Privacy

## Onboarding

9. Goal
10. Experience
11. Physical Information
12. Activity Level
13. Location
14. Equipment
15. Training Frequency
16. Session Duration
17. Target Muscles
18. Schedule
19. Assessment
20. Plan Generation
21. Plan Ready

## Main application

22. Home
23. Plan
24. Calendar
25. Workout Library
26. Exercise Library
27. Exercise Detail
28. Workout Detail
29. Workout Player
30. Set Logger
31. Rest Timer
32. Workout Summary
33. Workout History
34. History Detail
35. Progress Dashboard
36. Weight Tracking
37. Measurements
38. Goals
39. Challenges
40. Challenge Detail
41. Achievements
42. Favorites
43. Custom Workout
44. Custom Workout Editor

## Account

45. Profile
46. Edit Profile
47. Preferences
48. Notifications
49. Integrations
50. Subscription
51. Restore Purchases
52. Help
53. Support
54. Privacy Settings
55. Delete Account
56. Logout Confirmation

## Admin

57. Admin Login
58. Dashboard
59. Users
60. User Detail
61. Exercises
62. Exercise Editor
63. Workouts
64. Workout Editor
65. Plans
66. Plan Editor
67. Challenges
68. Challenge Editor
69. Notifications
70. Analytics
71. Support Tickets
72. Settings

---

# 56. Home Screen Functional Specification

## Inputs

- User profile
- Current plan
- Today's schedule
- Streak
- Recent progress
- Active challenge
- Subscription state

## Output

The home screen should show:

1. Greeting
2. Today's workout
3. Start button
4. Duration
5. Target muscles
6. Current streak
7. Weekly completion
8. Next session
9. Progress snapshot
10. Challenge
11. Recommended content

## Empty state

If no plan exists:

> Create your personalized plan

CTA:

> Build My Plan

---

# 57. Workout Summary

After completion display:

- Congratulations state
- Workout name
- Duration
- Exercises completed
- Sets completed
- Total volume
- Calories if available
- Streak update
- Weekly goal update
- Achievement unlocked
- Next workout

Actions:

- Done
- View Progress
- Schedule Next Workout

---

# 58. Progress Calculation

## Workout completion rate

`completed workouts / planned workouts × 100`

## Weekly consistency

`qualifying completed sessions / planned sessions × 100`

## Strength volume

`Σ(weight × repetitions)`

## Streak

Consecutive qualifying workout periods according to configured business rules.

## Goal progress

Depends on goal type.

For numeric goals:

`progress = (current - baseline) / (target - baseline)`

The system must handle decreasing targets correctly.

---

# 59. Calories

Calories may be estimated using available user and workout information.

The application must label calorie values as estimates.

Calories must not be presented as exact measurements unless obtained from a supported measurement source.

---

# 60. Accessibility

The application shall support:

- Dynamic text where platform allows
- Screen readers
- Sufficient contrast
- Large touch targets
- Keyboard navigation on web
- Captions/subtitles for videos where available
- Reduced motion preferences
- Clear error messages
- Non-color-only status indicators

---

# 61. Internationalization

The system should support:

- English
- French
- Arabic
- Additional languages later

Requirements:

- Externalize all strings.
- Support pluralization.
- Support RTL for Arabic.
- Store dates in UTC and render in user time zone.
- Store measurement units independently from display units.

---

# 62. Localization

Localized content includes:

- Exercise instructions
- Workout names
- Buttons
- Notifications
- Subscription text
- Errors
- Legal text

Exercise names should have stable IDs independent of language.

---

# 63. Error Handling

## Authentication

Examples:

- Invalid credentials
- Account not found
- Email already registered
- Expired verification

## Workout

Examples:

- Workout unavailable
- Exercise unavailable
- Sync failure
- Media unavailable

## Subscription

Examples:

- Purchase failed
- Purchase pending
- Verification failed
- Subscription expired

Errors should be:

- Human-readable
- Actionable
- Non-technical where possible

---

# 64. Loading States

Every network-dependent screen shall define:

- Initial loading
- Refreshing
- Empty
- Error
- Retry

Workout execution should minimize network dependency.

---

# 65. Security Requirements

- Encrypt data in transit.
- Encrypt sensitive data at rest where appropriate.
- Use secure authentication.
- Never log passwords.
- Never expose payment credentials.
- Apply authorization server-side.
- Use role-based access control.
- Rate-limit authentication endpoints.
- Protect admin endpoints.
- Audit sensitive admin actions.

---

# 66. Privacy

The application should clearly disclose:

- What fitness data is collected.
- Why it is collected.
- Which integrations receive data.
- How users can delete data.
- How subscription information is processed.

Users should be able to control optional data sharing.

---

# 67. Content Versioning

Exercises and workouts should be versionable.

When content changes:

- New users receive the current version.
- Existing historical sessions retain historical metadata.
- Analytics can distinguish content versions.

---

# 68. Media Management

Exercise media should support:

- Thumbnail
- Preview
- Full video
- Multiple resolutions
- Captions
- Poster image

Media should be delivered through a CDN.

---

# 69. Performance Requirements

Target:

- App launch: fast initial render
- Main screens: responsive
- Workout transitions: near-instant
- Timers: continue reliably in foreground
- Cached workouts: usable without network
- Images/videos: progressively loaded

Exact performance budgets should be validated against target devices.

---

# 70. Reliability

Workout logging must be resilient.

If network connectivity is lost during a workout:

1. Continue workout.
2. Store events locally.
3. Mark them pending synchronization.
4. Sync when connectivity returns.
5. Prevent duplicate submissions.

---

# 71. Testing Strategy

## Unit testing

Test:

- Recommendation rules
- Progress calculations
- Subscription state
- Streak calculation
- Goal calculation
- Workout completion
- Synchronization

## Integration testing

Test:

- Authentication
- Payments
- Health integrations
- API
- Push notifications
- Database

## UI testing

Test:

- Onboarding
- Workout player
- Set logging
- Progress
- Subscription

## End-to-end testing

Critical journey:

`Register → Onboarding → Plan → Workout → Complete → Progress`

---

# 72. Acceptance Criteria — Onboarding

A feature is accepted when:

- User can complete onboarding.
- Required fields are validated.
- User can navigate backward.
- User can edit answers before completion.
- Preferences are persisted.
- A personalized plan can be generated.
- Invalid inputs produce clear errors.

---

# 73. Acceptance Criteria — Workout

A feature is accepted when:

- User can start a workout.
- User can complete sets.
- User can modify actual reps/weight.
- Rest timer works.
- User can pause/resume.
- User can skip.
- User can replace an exercise.
- Workout can be completed.
- History is updated.
- Progress is updated.
- Offline logging works where supported.

---

# 74. Acceptance Criteria — Progress

A feature is accepted when:

- Completed workouts appear.
- Weight entries appear.
- Charts update.
- Strength data updates.
- Streak updates correctly.
- Goal progress updates.
- Deleted/edited measurements are reflected.

---

# 75. Acceptance Criteria — Subscription

A feature is accepted when:

- User can view plans.
- Purchase flow opens correctly.
- Purchase is verified.
- Premium access is granted.
- Restore purchases works.
- Expiration removes premium access.
- Paywall displays correct terms.
- Subscription status is synchronized.

---

# 76. MVP Definition

## MVP must include

### Account

- Registration
- Login
- Password reset

### Onboarding

- Goal
- Level
- Age
- Height
- Weight
- Equipment
- Location
- Frequency
- Duration

### Workout

- Personalized beginner plan
- Exercise library
- Exercise detail
- Workout player
- Sets/reps
- Rest timer
- Exercise replacement
- Workout completion

### Tracking

- Workout history
- Weight tracking
- Basic progress

### Engagement

- Streak
- Notifications

### Monetization

- Free tier
- Premium tier
- Subscription

### Admin

- Exercise management
- Workout management
- User management

---

# 77. Phase 2

- Advanced AI adaptation
- Challenges
- Achievements
- Body measurements
- Advanced analytics
- Health integrations
- Wearables
- Custom workouts
- Voice coaching
- Advanced scheduling

---

# 78. Phase 3

- Social features
- Community
- Trainer marketplace
- Live coaching
- Nutrition planning
- Advanced computer-vision exercise analysis
- Advanced wearable integrations
- Personalized recovery modeling

---

# 79. Recommended Technical Architecture

A possible architecture:

## Mobile

- React Native / Expo or Flutter

## Backend

- Node.js / NestJS or equivalent
- REST or GraphQL API

## Database

- PostgreSQL

## Authentication

- Managed authentication provider or secure custom authentication

## Storage

- Object storage for images/videos

## CDN

- CDN for media delivery

## Notifications

- Firebase Cloud Messaging
- Apple Push Notification Service

## Analytics

- Product analytics platform

## Payments

- Apple App Store billing
- Google Play Billing
- Optional web payment provider where legally and technically appropriate

---

# 80. API Domains

Suggested API modules:

```text
/auth
/users
/preferences
/goals
/assessments
/exercises
/workouts
/plans
/workout-sessions
/exercise-sets
/progress
/measurements
/calendar
/challenges
/achievements
/notifications
/subscriptions
/integrations
/support
/admin
/analytics
```

---

# 81. Example API Operations

## Authentication

```text
POST /auth/register
POST /auth/login
POST /auth/logout
POST /auth/forgot-password
POST /auth/reset-password
```

## Exercises

```text
GET /exercises
GET /exercises/:id
POST /exercises/:id/favorite
DELETE /exercises/:id/favorite
```

## Workouts

```text
GET /workouts
GET /workouts/:id
POST /workouts/generate
POST /workouts/:id/start
POST /workouts/:id/replace-exercise
```

## Sessions

```text
POST /workout-sessions
POST /workout-sessions/:id/sets
POST /workout-sessions/:id/pause
POST /workout-sessions/:id/resume
POST /workout-sessions/:id/complete
```

## Progress

```text
GET /progress
GET /progress/strength
GET /progress/weight
GET /progress/measurements
```

---

# 82. Recommendation Data Flow

```text
User Profile
     |
     v
Goals + Experience
     |
     v
Equipment + Location
     |
     v
Schedule + Duration
     |
     v
Workout History
     |
     v
Recommendation Engine
     |
     v
Exercise Candidate Pool
     |
     v
Filtering / Constraints
     |
     v
Workout Assembly
     |
     v
Duration Validation
     |
     v
Personalized Workout
```

---

# 83. Workout Execution Data Flow

```text
Start Workout
     |
     v
Create Session
     |
     v
Load Exercise
     |
     v
Complete Set
     |
     v
Store Reps / Weight
     |
     v
Rest Timer
     |
     v
Next Set
     |
     v
Next Exercise
     |
     v
Workout Complete
     |
     v
Calculate Statistics
     |
     v
Update Progress
     |
     v
Update Streak
     |
     v
Update Recommendations
```

---

# 84. Product Configuration

The following should be configurable without an app release:

- Free workout count
- Premium feature gates
- Workout durations
- Difficulty rules
- Progression rules
- Streak rules
- Challenge rules
- Notification templates
- Subscription products
- Exercise availability
- Workout availability

---

# 85. Feature Flags

Recommended feature flags:

```text
ai_workout_generation
advanced_progress
health_integration
wearable_support
voice_guidance
challenges
achievements
custom_workouts
body_measurements
nutrition
social_features
```

Feature flags should support:

- Enable
- Disable
- User percentage rollout
- Country rollout
- Platform rollout

---

# 86. Admin Permissions

Recommended permissions:

```text
users.read
users.update
users.suspend
exercises.read
exercises.create
exercises.update
exercises.publish
workouts.read
workouts.create
workouts.update
workouts.publish
plans.manage
challenges.manage
notifications.send
analytics.read
subscriptions.read
support.manage
```

---

# 87. Audit Logging

Admin actions should record:

- Admin ID
- Action
- Entity
- Entity ID
- Timestamp
- Previous value where appropriate
- New value where appropriate
- IP/device information where legally appropriate

---

# 88. Data Retention

Retention periods must be defined by the final privacy/legal policy.

The system should support:

- Data export
- Account deletion
- Data anonymization
- Retention rules
- Audit-log retention

---

# 89. User Data Export

User may request an export containing, where applicable:

- Profile
- Goals
- Workouts
- Workout history
- Weight
- Measurements
- Achievements
- Subscription-related information where legally required

Export format may be JSON/CSV.

---

# 90. Accessibility Acceptance Criteria

The application passes accessibility review when:

- Core actions are usable with screen readers.
- Buttons have accessible labels.
- Text can be enlarged within supported limits.
- Important status information is not conveyed by color alone.
- Videos provide captions where applicable.
- Interactive controls have adequate touch targets.

---

# 91. Privacy Acceptance Criteria

The application passes privacy review when:

- Consent flows are implemented.
- Optional permissions are explicit.
- Account deletion is available.
- Health permissions are transparent.
- Sensitive data is access-controlled.
- Privacy policy is accessible.
- Data export/deletion workflows function correctly.

---

# 92. QA Critical Scenarios

## Scenario 1 — Beginner onboarding

Expected:

- User completes onboarding.
- Beginner plan generated.
- Equipment constraints respected.

## Scenario 2 — No equipment

Expected:

- Only compatible exercises appear.

## Scenario 3 — Gym equipment

Expected:

- Equipment-specific workouts can be generated.

## Scenario 4 — Missed workout

Expected:

- Workout remains incomplete.
- User can reschedule.

## Scenario 5 — Offline workout

Expected:

- Workout can continue.
- Data synchronizes later.

## Scenario 6 — Exercise replacement

Expected:

- Replacement targets compatible muscle/movement.
- Existing completed data remains unchanged.

## Scenario 7 — Subscription expires

Expected:

- Premium content becomes inaccessible according to entitlement rules.
- Historical workouts remain available.

## Scenario 8 — Account deletion

Expected:

- User is logged out.
- Deletion/anonymization process starts.
- Login no longer works after completion.

---

# 93. Definition of Done

A feature is considered complete when:

- Functional requirements implemented.
- UX states implemented.
- API implemented.
- Database changes implemented.
- Authorization implemented.
- Analytics events implemented where applicable.
- Unit tests added.
- Integration tests added.
- UI tests added for critical flows.
- Error states implemented.
- Loading states implemented.
- Empty states implemented.
- Accessibility reviewed.
- Localization reviewed.
- Documentation updated.
- QA approved.

---

# 94. Product Success Metrics

Primary:

- Onboarding completion
- First workout completion
- Weekly workout completion
- D7 retention
- D30 retention
- Workout completion rate
- Premium conversion

Secondary:

- Exercise replacement rate
- Workout regeneration rate
- Average sessions/week
- Streak participation
- Challenge participation
- Progress tracking usage

Quality:

- Workout crash rate
- Sync failure rate
- Payment failure rate
- Support ticket rate

---

# 95. Recommended Beginner Default

For a new beginner, the default experience should prioritize:

1. Simple onboarding.
2. One clear goal.
3. A manageable weekly schedule.
4. Short-to-moderate sessions.
5. Simple exercises.
6. Video demonstrations.
7. Clear sets and repetitions.
8. Visible rest timer.
9. Easy exercise replacement.
10. Automatic workout logging.
11. Progress feedback.
12. Gentle reminders.
13. No excessive complexity.

The application should progressively expose advanced functionality rather than overwhelming a new user.

---

# 96. Final Functional Product Definition

The application is complete when a beginner can:

1. Create an account.
2. Explain their fitness goal.
3. Provide their physical and training profile.
4. Select available equipment.
5. Receive a personalized training plan.
6. Understand every recommended exercise.
7. Start and execute a workout.
8. Record sets, repetitions, weights and time.
9. Rest between sets using an integrated timer.
10. Replace unsuitable exercises.
11. Pause and resume workouts.
12. Complete a workout.
13. See an accurate workout summary.
14. See the workout in their history.
15. Track body weight.
16. Track physical measurements.
17. See training progress.
18. Maintain a consistency streak.
19. Participate in challenges.
20. Receive useful reminders.
21. Modify their plan.
22. Upgrade to premium if desired.
23. Restore their subscription.
24. Manage their privacy.
25. Export/delete their account data.
26. Continue basic workout execution during temporary connectivity loss.
27. Have their completed workout synchronized after reconnection.

---

# 97. Implementation Priority

## P0 — Required for launch

- Authentication
- Onboarding
- Goals
- Exercise library
- Workout library
- Personalized beginner plan
- Workout player
- Set tracking
- Rest timer
- Exercise replacement
- Workout history
- Weight tracking
- Basic progress
- Calendar
- Notifications
- Subscription
- Admin exercise management
- Admin workout management
- Core analytics
- Security
- Privacy

## P1 — High-value post-launch

- Challenges
- Achievements
- Custom workouts
- Body measurements
- Advanced progression
- Health integration
- Voice coaching
- Advanced analytics

## P2 — Expansion

- Wearables
- Nutrition
- Social/community
- Trainer marketplace
- Live coaching
- Computer vision
- Advanced recovery

---

# 98. Final Note

This specification defines the expected product behavior and can be used as the baseline for:

- UX/UI design
- Product backlog creation
- Database design
- API design
- Mobile development
- Admin development
- QA test-case creation
- Analytics implementation
- Subscription implementation

It intentionally separates **functional behavior** from visual branding and implementation technology so that the product can evolve without changing its core requirements.
