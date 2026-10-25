# Manual test cases

Generated from the same Gherkin scenarios used for coverage. Start with [new laptop setup](new-laptop.md). Each Given describes preparation; the When is the action and the Then is the expected result. Reset before a fresh test session. Automated cases can also be followed manually.

For each case record: commit, tester, date, device/browser, actual result, Passed / Failed / Blocked / Not run, evidence and issue link. Copy this document for an execution record; do not overwrite the generated source with results.

## TC_AUTO_FAMILY_001 Parent and administrator read the correct learner

P0 | Automated - execution pending | Linked family access across both apps

1. **Given** I am signed in to the portal as "adminA"
2. **When** the parent signs in and reads their linked children
3. **Then** the administrator still sees only School A learners

Result: Not run. Evidence: —

## TC_AUTO_FAMILY_002 A parent connects a child using the supplied family code

P0 | Automated - execution pending | Linked family access across both apps

1. **Given** I am signed in to the portal as "adminA"
2. **When** a parent connects Learner A using the family code
3. **Then** the administrator still sees only School A learners

Result: Not run. Evidence: —

## TC_AUTO_AUTH_001 Administrator signs in through the form

P0 | Automated - execution pending | Portal authentication and permissions

1. **Given** I am on the portal sign-in screen
2. **When** I sign in with the fictional administrator credentials
3. **Then** I reach the applications workspace

Result: Not run. Evidence: —

## TC_AUTO_AUTH_002 Incorrect password is rejected

P0 | Automated - execution pending | Portal authentication and permissions

1. **Given** I am on the portal sign-in screen
2. **When** I enter an incorrect password
3. **Then** the login is rejected with a readable error

Result: Not run. Evidence: —

## TC_AUTO_AUTH_003 Teacher navigation excludes administrator functions

P0 | Automated - execution pending | Portal authentication and permissions

1. **Given** I am signed in to the portal as "teacherA"
2. **Then** I cannot see enrolment links in teacher navigation

Result: Not run. Evidence: —

## TC_AUTO_AUTH_004 Teacher cannot open applications directly

P0 | Automated - execution pending | Portal authentication and permissions

1. **Given** I am signed in to the portal as "teacherA"
2. **When** I open the portal page "/applications"
3. **Then** I am redirected away from "/applications"

Result: Not run. Evidence: —

## TC_AUTO_AUTH_005 Administrator cannot read another school learners

P0 | Automated - execution pending | Portal authentication and permissions

1. **Given** I am signed in to the portal as "adminA"
2. **Then** the API does not expose School B learners to this account

Result: Not run. Evidence: —

## TC_AUTO_AUTH_006 Teacher cannot read another school learners

P0 | Automated - execution pending | Portal authentication and permissions

1. **Given** I am signed in to the portal as "teacherA"
2. **Then** the API does not expose School B learners to this account

Result: Not run. Evidence: —

## TC_AUTO_PROFILE_001 Save profile and verify persistence

P0 | Automated - execution pending | Profile save and action feedback

1. **Given** I am signed in to the portal as "adminA"
2. **When** I open the portal page "/school"
3. **And** I save a new school tagline from the bottom of the form
4. **Then** a floating success notification confirms the saved profile
5. **And** the school tagline remains saved after refresh

Result: Not run. Evidence: —

## TC_AUTO_PROFILE_002 Failed save never claims success

P0 | Automated - execution pending | Profile save and action feedback

1. **Given** I am signed in to the portal as "adminA"
2. **And** the next school profile update will fail
3. **When** I open the portal page "/school"
4. **And** I save a new school tagline from the bottom of the form
5. **Then** a floating error is shown without claiming success

Result: Not run. Evidence: —

## TC_PAPER_001 Draft a complete paper

P0 | Manual | Assessment paper authoring review and print

1. **Given** Teacher A is assigned to Grade 3 A Mathematics
2. **When** they create questions, marks, instructions, answer lines and a fictional image then save and reopen
3. **Then** all content and total marks are preserved

Result: Not run. Evidence: —

## TC_PAPER_002 Return revise and approve

P0 | Manual | Assessment paper authoring review and print

1. **Given** Teacher A saved a draft and selected administrator A as reviewer
2. **When** they submit, receive reviewer feedback, correct and resubmit, and the reviewer approves
3. **Then** feedback and approval are recorded and approved content is fixed

Result: Not run. Evidence: —

## TC_PAPER_003 Separate learner and memorandum printing

P1 | Manual | Assessment paper authoring review and print

1. **Given** an approved paper contains model answers
2. **When** staff print the learner copy and then the memorandum
3. **Then** the learner copy contains questions and answer space without answers and the separate memorandum includes the correct answers

Result: Not run. Evidence: —

## TC_PAPER_004 Create mark capture from paper

P1 | Manual | Assessment paper authoring review and print

1. **Given** an approved paper has a known class, subject, year, term and total
2. **When** the teacher creates its assessment and opens mark capture
3. **Then** the assessment matches the paper and the correct learner grid appears

Result: Not run. Evidence: —

## TC_PAPER_005 Reject incompatible assessment link

P1 | Manual | Assessment paper authoring review and print

1. **Given** a paper and assessment differ in subject or maximum score
2. **When** a user links them
3. **Then** the link is rejected and both remain unchanged

Result: Not run. Evidence: —

## TC_PAPER_006 Revision preserves approved original

P1 | Manual | Assessment paper authoring review and print

1. **Given** an approved paper needs correction
2. **When** its author creates a revised copy
3. **Then** the new draft references the immutable original and can be edited separately

Result: Not run. Evidence: —

## TC_PAPER_007 Reusable template defaults

P1 | Manual | Assessment paper authoring review and print

1. **Given** administrator A creates a template with instructions and layout defaults
2. **When** Teacher A creates a paper using it
3. **Then** defaults apply without copying confidential answers from another paper

Result: Not run. Evidence: —

## TC_PAPER_008 Draft ownership and school isolation

P1 | Manual | Assessment paper authoring review and print

1. **Given** Teacher A owns a draft
2. **When** an unrelated teacher or School B user attempts to edit through UI or API
3. **Then** access is denied and the draft remains unchanged

Result: Not run. Evidence: —

## TC_PAPER_009 Unsaved edits and image validation

P1 | Manual | Assessment paper authoring review and print

1. **Given** a teacher has unsaved paper changes
2. **When** they navigate away and cancel or choose an unsupported image
3. **Then** cancelling keeps the draft and invalid images produce a readable error without being saved

Result: Not run. Evidence: —

## TC_ASSESS_001 Calculate weighted term percentage

P0 | Manual | Assessment scores and calculations

1. **Given** two Mathematics assessments have maximums 10 and 20 and equal weights
2. **When** Teacher A records scores 5 and 16 for Learner A
3. **Then** the term percentage is 65 and both scores persist after refresh

Result: Not run. Evidence: —

## TC_ASSESS_002 Roll up into draft reports

P0 | Manual | Assessment scores and calculations

1. **Given** assessment scores produce a known term percentage
2. **When** an authorised user rolls them into draft reports
3. **Then** the draft matches the calculation without silently overwriting an approved or published report

Result: Not run. Evidence: —

## TC_ASSESS_003 Reject out of range scores

P1 | Manual | Assessment scores and calculations

1. **Given** an assessment has maximum score 10
2. **When** a teacher enters a negative score or a score above 10
3. **Then** the invalid score is rejected and the last valid value remains stored

Result: Not run. Evidence: —

## TC_ASSESS_004 Missing absent and zero marks

P1 | Manual | Assessment scores and calculations

1. **Given** learners have a missing mark, an absence and an explicit zero
2. **When** the teacher reviews the grid and analysis
3. **Then** the states remain distinguishable and calculations follow the implemented assessment rules

Result: Not run. Evidence: —

## TC_ASSESS_005 Concurrent save failure

P1 | Manual | Assessment scores and calculations

1. **Given** two learner score writes are pending
2. **When** one succeeds and the other fails
3. **Then** the successful score persists, the error is visible and the UI does not claim all scores were saved

Result: Not run. Evidence: —

## TC_ASSESS_006 Export assessment analysis

P1 | Manual | Assessment scores and calculations

1. **Given** the selected class has recorded scores
2. **When** the teacher exports assessment and subject analysis
3. **Then** files contain correct scores and totals for the selected class without other-school data

Result: Not run. Evidence: —

## TC_ATT_001 Register reaches the parent

P0 | Manual | Attendance and absence reporting

1. **Given** Teacher A opens the class register for today
2. **When** they mark Learner A absent with a note and save
3. **Then** the value persists and parent A sees the matching attendance date and status

Result: Not run. Evidence: —

## TC_ATT_002 Report and acknowledge absence

P0 | Manual | Attendance and absence reporting

1. **Given** parent A opens Report absence for Learner A
2. **When** they submit dates and a reason and the school acknowledges the note
3. **Then** the note reaches authorised school staff and its acknowledgement is saved

Result: Not run. Evidence: —

## TC_ATT_003 Invalid absence dates

P1 | Manual | Attendance and absence reporting

1. **Given** an absence form is open
2. **When** the end date precedes the start date or the reason is empty
3. **Then** validation prevents submission and identifies the problem

Result: Not run. Evidence: —

## TC_ATT_004 Correct the same attendance record

P1 | Manual | Attendance and absence reporting

1. **Given** a learner already has an attendance record for today
2. **When** the teacher saves a corrected status for the same date
3. **Then** one record remains with the corrected status after refresh

Result: Not run. Evidence: —

## TC_ATT_005 Deny unrelated attendance access

P1 | Manual | Attendance and absence reporting

1. **Given** an unassigned teacher and parent B sign in separately
2. **When** they read or write Learner A attendance
3. **Then** the database denies unauthorised access

Result: Not run. Evidence: —

## TC_AUTH_001 Parent signup and email confirmation

P0 | Manual | Authentication and account lifecycle

1. **Given** a new parent uses an unused example.test email
2. **When** the parent signs up with valid name, phone and password and follows the link in local mail at port 55324
3. **Then** the confirmed account can sign in and open My children

Result: Not run. Evidence: —

## TC_AUTH_002 Password reset returns to the requesting app

P0 | Manual | Authentication and account lifecycle

1. **Given** a confirmed parent or administrator has signed out
2. **When** they request a reset from their app, follow the local email link and save a new password
3. **Then** the new password works, the old password fails and the return stays in the requesting app

Result: Not run. Evidence: —

## TC_AUTH_003 Invalid signup fields

P1 | Manual | Authentication and account lifecycle

1. **Given** the parent signup form is open
2. **When** the parent enters an invalid email, phone or short password
3. **Then** invalid fields are identified and no account is created

Result: Not run. Evidence: —

## TC_AUTH_004 Expired and reused links

P1 | Manual | Authentication and account lifecycle

1. **Given** a confirmation or reset link has expired or already been used
2. **When** the user opens that link
3. **Then** a readable recovery action is shown and no protected account change occurs

Result: Not run. Evidence: —

## TC_AUTH_005 Sign out clears private state

P1 | Manual | Authentication and account lifecycle

1. **Given** a parent or teacher has opened private learner details
2. **When** they sign out and use browser Back and refresh
3. **Then** private content is absent and protected pages require sign-in

Result: Not run. Evidence: —

## TC_AUTH_006 Account switching

P1 | Manual | Authentication and account lifecycle

1. **Given** parent A has viewed Learner A and signed out
2. **When** parent B signs in on the same browser
3. **Then** only Learner B appears and no School A private data or notifications remain

Result: Not run. Evidence: —

## TC_AUTH_007 Session loss across tabs

P1 | Manual | Authentication and account lifecycle

1. **Given** the same account is signed in in two tabs
2. **When** the first tab signs out or the session becomes unrenewable
3. **Then** the other tab removes private content on session loss and protected writes are denied

Result: Not run. Evidence: —

## TC_AUTH_008 CAPTCHA expiry and retry

P1 | Manual | Authentication and account lifecycle

1. **Given** an authentication form has an expired or failed test challenge
2. **When** the user submits and then obtains a fresh test challenge
3. **Then** stale tokens are not submitted and the fresh challenge allows a new attempt

Result: Not run. Evidence: —

## TC_AUTH_009 Password visibility

P1 | Manual | Authentication and account lifecycle

1. **Given** a password has been typed on sign-in, signup or school registration
2. **When** the user selects Show and then Hide
3. **Then** the value remains unchanged and the control has the correct accessible label

Result: Not run. Evidence: —

## TC_CAL_001 School event reaches parents

P0 | Manual | School calendar

1. **Given** administrator A creates a school event with date and time
2. **When** parent A and parent B open calendars
3. **Then** A sees the correct event and B cannot see School A private events

Result: Not run. Evidence: —

## TC_CAL_002 Class event audience

P0 | Manual | School calendar

1. **Given** an event is restricted to Grade 3 A
2. **When** linked and unrelated parents open calendars
3. **Then** only its permitted audience sees the event

Result: Not run. Evidence: —

## TC_CAL_003 Edit and delete event

P1 | Manual | School calendar

1. **Given** an authorised school user created an event
2. **When** they change its date and later delete it
3. **Then** each saved change reaches school and parent views after refresh

Result: Not run. Evidence: —

## TC_CAL_004 Date and time validation

P1 | Manual | School calendar

1. **Given** an event editor is open
2. **When** the user enters missing details or invalid time ranges and then corrects them
3. **Then** invalid data is rejected and valid timed and all-day events display correctly in South African time

Result: Not run. Evidence: —

## TC_CLASS_001 Create class and assign teacher

P0 | Manual | Classes subjects and teaching assignments

1. **Given** administrator A has selected the current academic year
2. **When** they create Grade 3 class B and assign Teacher A
3. **Then** the class and assignment persist and Teacher A can read its roster

Result: Not run. Evidence: —

## TC_CLASS_002 Subject teacher assignment

P0 | Manual | Classes subjects and teaching assignments

1. **Given** administrator A creates Grade 4 A and Mathematics
2. **When** they assign Teacher A to Mathematics in that class
3. **Then** Teacher A can access that assignment and an unassigned teacher cannot

Result: Not run. Evidence: —

## TC_CLASS_003 Duplicate class

P1 | Manual | Classes subjects and teaching assignments

1. **Given** Grade 3 A already exists in the current school and year
2. **When** an administrator creates the same class again
3. **Then** the duplicate is rejected without a second class

Result: Not run. Evidence: —

## TC_CLASS_004 Subjects and school defaults

P1 | Manual | Classes subjects and teaching assignments

1. **Given** administrator A opens the subjects for a grade
2. **When** they load defaults, rename a subject and load defaults again
3. **Then** saved subjects remain consistent without duplicates and School B is unchanged

Result: Not run. Evidence: —

## TC_CLASS_005 Year and teaching model settings

P1 | Manual | Classes subjects and teaching assignments

1. **Given** two schools have different teaching thresholds and classes in two years
2. **When** the administrators change the selected year and teaching model
3. **Then** class and subject views follow each school setting and year without modifying the other school

Result: Not run. Evidence: —

## TC_ENROL_001 Submit application and documents

P0 | Manual | Enrolment from directory to school decision

1. **Given** a confirmed parent finds Test School A with Grade 3 capacity
2. **When** they submit valid learner, guardian, address and consent details and upload fictional required documents
3. **Then** one submitted application with a unique reference appears and administrator A can review the same records

Result: Not run. Evidence: —

## TC_ENROL_002 Declare EFT and confirm payment

P0 | Manual | Enrolment from directory to school decision

1. **Given** a submitted application has unpaid status
2. **When** the parent marks EFT paid and administrator A later confirms it
3. **Then** status first becomes marked paid, then confirmed and accepted with a welcome message to the parent

Result: Not run. Evidence: —

## TC_ENROL_003 Request missing information

P1 | Manual | Enrolment from directory to school decision

1. **Given** administrator A is reviewing an application
2. **When** they request a missing document and the parent uploads it
3. **Then** the parent sees the request and the administrator can review the replacement before deciding

Result: Not run. Evidence: —

## TC_ENROL_004 Reject duplicate applications

P1 | Manual | Enrolment from directory to school decision

1. **Given** a learner has an active application for School A in the selected year
2. **When** the parent submits another for the same learner, school and year
3. **Then** the duplicate is rejected and capacity is not consumed twice

Result: Not run. Evidence: —

## TC_ENROL_005 Closed and full grades

P1 | Manual | Enrolment from directory to school decision

1. **Given** Grade 1 is closed and Grade 4 has zero capacity in the local intake
2. **When** a parent attempts to apply to either grade
3. **Then** submission is refused without creating an application

Result: Not run. Evidence: —

## TC_ENROL_006 Last place race

P1 | Manual | Enrolment from directory to school decision

1. **Given** exactly one place remains in an open grade
2. **When** two parents submit valid applications concurrently
3. **Then** one application receives the place and the other gets a capacity error

Result: Not run. Evidence: —

## TC_ENROL_007 Withdraw and release capacity

P1 | Manual | Enrolment from directory to school decision

1. **Given** an active application holds one grade place
2. **When** its parent withdraws and confirms the action
3. **Then** the application becomes withdrawn and capacity increases exactly once

Result: Not run. Evidence: —

## TC_ENROL_008 Decline and waitlist

P1 | Manual | Enrolment from directory to school decision

1. **Given** administrator A reviews two submitted applications
2. **When** one is declined and the other waitlisted
3. **Then** parents see the correct decisions and only the declined application releases its place

Result: Not run. Evidence: —

## TC_ENROL_009 Invalid transition

P1 | Manual | Enrolment from directory to school decision

1. **Given** an application is in a terminal state
2. **When** an administrator requests a transition outside the permitted status rules
3. **Then** the transition is rejected and saved state and history remain unchanged

Result: Not run. Evidence: —

## TC_ENROL_010 Unsupported file and replacement

P1 | Manual | Enrolment from directory to school decision

1. **Given** a parent opens application documents
2. **When** they select an unsupported or oversized file and then a supported replacement
3. **Then** the invalid upload is rejected and the replacement is available only to authorised users

Result: Not run. Evidence: —

## TC_ENROL_011 Teachers have no enrolment access

P1 | Manual | Enrolment from directory to school decision

1. **Given** Teacher A is signed in
2. **When** they open application, payment queue and private applicant document URLs or API requests
3. **Then** no applicant details or documents are disclosed

Result: Not run. Evidence: —

## TC_ENROL_012 Submission failure and retry

P1 | Manual | Enrolment from directory to school decision

1. **Given** a completed application form is ready
2. **When** the API fails during submission and the parent retries after recovery
3. **Then** the failure is visible and exactly one successful application is created

Result: Not run. Evidence: —

## TC_FAMILY_001 Redeem a family code

P0 | Manual | Parents connect children

1. **Given** new.parent@example.test has no linked children and Learner A has code FAMILYA23
2. **When** the parent signs in and enters the code using Connect child
3. **Then** Learner A appears once with School A and remains after refresh

Result: Not run. Evidence: —

## TC_FAMILY_002 Multiple children

P0 | Manual | Parents connect children

1. **Given** a parent has one linked child and a valid code for another
2. **When** the parent redeems the second code
3. **Then** both children appear with their correct schools

Result: Not run. Evidence: —

## TC_FAMILY_003 Repeated redemption

P1 | Manual | Parents connect children

1. **Given** parent A is already linked to Learner A
2. **When** the parent submits FAMILYA23 again
3. **Then** the learner appears once and no duplicate parent link is created

Result: Not run. Evidence: —

## TC_FAMILY_004 Regenerated and invalid codes

P1 | Manual | Parents connect children

1. **Given** administrator A regenerates a learner family code
2. **When** an unlinked parent tries the old or invalid code and then the new code
3. **Then** invalid attempts create no links and the new code links the correct child

Result: Not run. Evidence: —

## TC_FAMILY_005 Direct unrelated child access

P1 | Manual | Parents connect children

1. **Given** parent B is linked only to Learner B
2. **When** parent B opens direct URLs and API requests for Learner A reports, attendance and fees
3. **Then** no private information about Learner A is returned

Result: Not run. Evidence: —

## TC_FEES_001 Charges and statement

P0 | Manual | Fees accounts payments and balances

1. **Given** administrator A configures a fictional fee structure and learner account
2. **When** charges are generated for the selected period
3. **Then** the balance equals the charges and parent A sees the matching statement

Result: Not run. Evidence: —

## TC_FEES_002 Confirm payment exactly once

P0 | Manual | Fees accounts payments and balances

1. **Given** Learner A owes 1000 rand in fictional charges
2. **When** an administrator records and confirms 400 rand then repeats confirmation
3. **Then** the confirmed balance is 600 rand and no second deduction occurs

Result: Not run. Evidence: —

## TC_FEES_003 Unconfirmed payment

P1 | Manual | Fees accounts payments and balances

1. **Given** a payment is recorded but not confirmed
2. **When** administrator and parent inspect the account
3. **Then** the payment state is clear and the balance follows the confirmed-payment rule

Result: Not run. Evidence: —

## TC_FEES_004 Invalid payment amount

P1 | Manual | Fees accounts payments and balances

1. **Given** an administrator opens Record payment
2. **When** they enter zero, a negative amount or missing required details
3. **Then** validation rejects the payment and the balance is unchanged

Result: Not run. Evidence: —

## TC_FEES_005 Arrears export

P1 | Manual | Fees accounts payments and balances

1. **Given** two learners have different unpaid balances
2. **When** administrator A exports arrears for the selected period
3. **Then** the export contains the correct learners and balances only for School A

Result: Not run. Evidence: —

## TC_FEES_006 Fees permissions

P1 | Manual | Fees accounts payments and balances

1. **Given** Teacher A and parent B sign in separately
2. **When** they request Learner A private fee account or confirm a payment
3. **Then** the operation is denied and the account remains unchanged

Result: Not run. Evidence: —

## TC_FUTURE_001 Staff idle and absolute expiry

P0 | Planned requirement | Agreed session controls awaiting implementation

1. **Given** the proposed server session layer has been implemented
2. **When** a staff session reaches 30 minutes of inactivity or eight hours total lifetime
3. **Then** the server denies further protected requests
4. **And** the interface provides a sign-in continuation
5. **And** a direct API request cannot bypass expiry

Result: Not run. Evidence: —

## TC_JOURNEY_001 A new school welcomes an applying family

P0 | Manual | Complete school teacher and family journeys

1. **Given** a new principal and parent use unique local example.test emails
2. **When** the principal registers and confirms a school
3. **And** the local operator verifies that fictional school
4. **And** its administrator sets the profile, fictional bank details, Grade 3 intake and class
5. **And** the parent confirms an account, finds the school and submits an application
6. **And** the parent uploads documents and declares the EFT payment
7. **And** the administrator reviews documents, confirms payment and places the learner in the class
8. **And** the administrator shares a family code which the parent redeems
9. **Then** the application is accepted and payment confirmed
10. **And** the parent receives the welcome message and sees the correct linked learner
11. **And** there is exactly one application, payment confirmation and family link

Result: Not run. Evidence: —

## TC_JOURNEY_002 A teacher prepares an assessment and a parent receives results

P0 | Manual | Complete school teacher and family journeys

1. **Given** a school has an administrator, assigned teacher, class, subjects and linked family
2. **When** the teacher drafts a question paper and sends it for review
3. **And** the administrator returns it with feedback
4. **And** the teacher corrects and resubmits it and the administrator approves
5. **And** the teacher prints the learner paper and memorandum separately
6. **And** the teacher creates its assessment and captures learner marks
7. **And** the teacher prepares term reports and the administrator approves and publishes them
8. **Then** the parent can read the correct published results after reopening the app
9. **And** the approved paper and published report remain protected from direct edits

Result: Not run. Evidence: —

## TC_JOURNEY_003 Family and teacher complete daily communication

P0 | Manual | Complete school teacher and family journeys

1. **Given** parent A is linked to Learner A in Teacher A's class
2. **When** the parent reports an absence and the school acknowledges it
3. **And** Teacher A saves the daily attendance register
4. **And** the parent starts a message thread and the teacher replies
5. **And** administrator A publishes a school notice and calendar event
6. **Then** parent A sees the correct attendance, conversation, notice and event after reopening
7. **And** unrelated families cannot see Learner A's private information

Result: Not run. Evidence: —

## TC_LEARNER_001 Import valid learners

P0 | Manual | Learner register imports and guardians

1. **Given** administrator A has a workbook matching the import template with two fictional learners
2. **When** they preview and confirm the import into Grade 3 A
3. **Then** exactly two learners persist with the correct names, dates and class

Result: Not run. Evidence: —

## TC_LEARNER_002 Review invalid import rows

P0 | Manual | Learner register imports and guardians

1. **Given** an import workbook contains a missing name, invalid date and duplicate admission number
2. **When** administrator A previews it
3. **Then** invalid rows and reasons are shown before saving and no invalid row is silently inserted

Result: Not run. Evidence: —

## TC_LEARNER_003 Create and update learner contacts

P1 | Manual | Learner register imports and guardians

1. **Given** administrator A opens the learner register
2. **When** they create a learner and later update guardian contact details
3. **Then** the learner and updated guardian information remain after refresh

Result: Not run. Evidence: —

## TC_LEARNER_004 Move a learner to another class

P1 | Manual | Learner register imports and guardians

1. **Given** Learner A belongs to a class with Teacher A
2. **When** the administrator moves the learner to a class with a different teacher
3. **Then** both rosters update and teacher access follows the new assignment

Result: Not run. Evidence: —

## TC_LEARNER_005 Identity and passport validation

P1 | Manual | Learner register imports and guardians

1. **Given** the learner editor is open
2. **When** an invalid South African ID is entered and then replaced with a supported passport alternative
3. **Then** invalid identity data is explained and a valid passport learner can be saved

Result: Not run. Evidence: —

## TC_LEARNER_006 Roster print safety

P1 | Manual | Learner register imports and guardians

1. **Given** learner names and notes contain angle brackets and quotation marks
2. **When** an administrator prints the selected class roster
3. **Then** text remains literal, essential content is readable and no script or other-school data appears

Result: Not run. Evidence: —

## TC_MSG_001 Conversation round trip

P0 | Manual | Messages between school and home

1. **Given** parent A is linked to Learner A
2. **When** the parent starts a thread and an authorised school user replies
3. **Then** the parent sees both messages in order after reopening the conversation

Result: Not run. Evidence: —

## TC_MSG_002 Class recipient scope

P0 | Manual | Messages between school and home

1. **Given** two classes have different linked families
2. **When** a school user messages class A
3. **Then** the intended recipients see it and unrelated families and schools cannot

Result: Not run. Evidence: —

## TC_MSG_003 Empty message validation

P1 | Manual | Messages between school and home

1. **Given** a message composer is open
2. **When** the user submits a missing subject or whitespace-only required body
3. **Then** no empty message is saved

Result: Not run. Evidence: —

## TC_MSG_004 Send succeeds but refresh fails

P1 | Manual | Messages between school and home

1. **Given** a reply is accepted and the subsequent conversation reload fails
2. **When** the action finishes
3. **Then** feedback distinguishes successful sending from refresh failure and does not encourage a duplicate

Result: Not run. Evidence: —

## TC_MSG_005 Read state and thread privacy

P1 | Manual | Messages between school and home

1. **Given** parent A receives a message
2. **When** they read it and parent B attempts to open the same private thread
3. **Then** the read state updates for A and B cannot read or reply

Result: Not run. Evidence: —

## TC_NOTICE_001 Publish to the intended audience

P0 | Manual | School notices

1. **Given** administrator A writes Test trip with body and audience
2. **When** they publish and parents refresh
3. **Then** intended School A parents see it and School B parents do not

Result: Not run. Evidence: —

## TC_NOTICE_002 Pin and unpin

P0 | Manual | School notices

1. **Given** School A has multiple published notices
2. **When** an authorised user pins an older notice then unpins it
3. **Then** pin state and ordering update correctly after each action

Result: Not run. Evidence: —

## TC_NOTICE_003 Remove notice

P1 | Manual | School notices

1. **Given** an authorised user can manage a published notice
2. **When** they remove it and confirm
3. **Then** the notice disappears from school and parent views after refresh

Result: Not run. Evidence: —

## TC_NOTICE_004 Validate and escape content

P1 | Manual | School notices

1. **Given** the notice composer is open
2. **When** the user submits missing content or later saves markup-like text
3. **Then** missing fields are rejected and saved text never executes script

Result: Not run. Evidence: —

## TC_REPORT_001 Publish report to parent

P0 | Manual | Term reports and publication

1. **Given** Teacher A has completed a draft report for Learner A
2. **When** administrator A approves and publishes it
3. **Then** parent A sees the expected subject results after refresh

Result: Not run. Evidence: —

## TC_REPORT_002 Draft privacy

P0 | Manual | Term reports and publication

1. **Given** Learner A has an unpublished draft report
2. **When** parent A opens reports or requests the draft through the API
3. **Then** draft contents are not available to the parent

Result: Not run. Evidence: —

## TC_REPORT_003 Lock approved reports

P1 | Manual | Term reports and publication

1. **Given** a report is approved or published
2. **When** a teacher edits marks or comments through UI or API
3. **Then** the report remains unchanged and the restriction is explained

Result: Not run. Evidence: —

## TC_REPORT_004 Fees never withhold reports

P1 | Manual | Term reports and publication

1. **Given** Learner A has unpaid fees and a published report
2. **When** parent A opens and prints the report
3. **Then** the published report is available regardless of the balance

Result: Not run. Evidence: —

## TC_REPORT_005 Achievement scale boundaries

P1 | Manual | Term reports and publication

1. **Given** marks are 29,30,39,40,49,50,59,60,69,70,79,80
2. **When** the report calculates achievement levels
3. **Then** levels are respectively 1,2,2,3,3,4,4,5,5,6,6,7

Result: Not run. Evidence: —

## TC_REPORT_006 Only administrators approve

P1 | Manual | Term reports and publication

1. **Given** Teacher A completed a draft report
2. **When** the teacher tries to approve or publish it
3. **Then** the operation is denied and the report remains a draft

Result: Not run. Evidence: —

## TC_REPORT_007 Print report and export schedule

P1 | Manual | Term reports and publication

1. **Given** a report includes school identity, learner, term and subject results
2. **When** a user prints it and an administrator exports the selected class schedule
3. **Then** content is correct and readable and exports match the selected school, year and class

Result: Not run. Evidence: —

## TC_REPORT_008 Other-family report denial

P1 | Manual | Term reports and publication

1. **Given** Learner A has a published report
2. **When** parent B or administrator B requests it by identifier
3. **Then** report contents and print data are unavailable

Result: Not run. Evidence: —

## TC_SCHOOL_001 Register a school

P0 | Manual | School registration and configuration

1. **Given** a new principal uses a unique example.test address
2. **When** they register, confirm local email and save a new fictional school
3. **Then** they become its administrator, reach its workspace and see the unverified state

Result: Not run. Evidence: —

## TC_SCHOOL_002 Claim an existing school

P0 | Manual | School registration and configuration

1. **Given** a fictional unclaimed school exists locally
2. **When** a confirmed principal claims it
3. **Then** the principal gains school access and an already claimed school cannot be claimed again

Result: Not run. Evidence: —

## TC_SCHOOL_003 Verification and enrolment

P1 | Manual | School registration and configuration

1. **Given** a newly registered school is unverified with an open intake
2. **When** a parent views it before and after the local test operator verifies it
3. **Then** availability follows verification and only the verified school exposes the eligible intake

Result: Not run. Evidence: —

## TC_SCHOOL_004 Profile badge and public details

P1 | Manual | School registration and configuration

1. **Given** administrator A opens School profile
2. **When** they change the tagline and upload a supported fictional badge
3. **Then** both persist after refresh and the parent directory shows the saved school details

Result: Not run. Evidence: —

## TC_SCHOOL_005 Bank details belong to the correct school

P1 | Manual | School registration and configuration

1. **Given** two schools have distinct fictional bank details
2. **When** a parent opens payment instructions for a School A application
3. **Then** the bank details and reference belong to School A and never School B

Result: Not run. Evidence: —

## TC_SCHOOL_006 Appearance reaches parents

P1 | Manual | School registration and configuration

1. **Given** parent A is online in the app
2. **When** administrator A previews then saves new school appearance colours
3. **Then** only the saved appearance reaches the parent app through its documented refresh cycle

Result: Not run. Evidence: —

## TC_UX_001 Feedback below the fold

P0 | Manual | Feedback mobile accessibility and installation

1. **Given** a long form is scrolled to its bottom
2. **When** a valid save succeeds
3. **Then** floating confirmation is visible without scrolling and saved data survives refresh

Result: Not run. Evidence: —

## TC_UX_002 Failure and retry

P0 | Manual | Feedback mobile accessibility and installation

1. **Given** the next save will fail because the local API is unavailable
2. **When** the user saves and later retries after recovery
3. **Then** the persistent error never claims success and the retry saves correctly

Result: Not run. Evidence: —

## TC_UX_003 Pause notification dismissal

P1 | Manual | Feedback mobile accessibility and installation

1. **Given** a success notification is visible
2. **When** the user hovers it, focuses its close button or hides the tab
3. **Then** dismissal pauses and resumes with the remaining time when those conditions end

Result: Not run. Evidence: —

## TC_UX_004 Feedback in modal drawers

P1 | Manual | Feedback mobile accessibility and installation

1. **Given** a learner or appearance drawer is open
2. **When** the user saves inside it
3. **Then** exactly one notification is visible above drawer content with an operable dismiss button

Result: Not run. Evidence: —

## TC_UX_005 Phone forms and keyboard

P1 | Manual | Feedback mobile accessibility and installation

1. **Given** both apps are opened on real phones
2. **When** a user completes a long form with the software keyboard visible
3. **Then** fields, save actions and errors are usable without sideways scrolling

Result: Not run. Evidence: —

## TC_UX_006 Keyboard access and reduced motion

P1 | Manual | Feedback mobile accessibility and installation

1. **Given** reduced motion is enabled
2. **When** the user completes actions using only the keyboard
3. **Then** focus is visible, controls have meaningful names and optional animations are reduced

Result: Not run. Evidence: —

## TC_UX_007 Install parent app

P1 | Manual | Feedback mobile accessibility and installation

1. **Given** Android Chrome or iOS Safari opens the deployed parent app
2. **When** the user follows Install Skoolo or Add to Home Screen instructions
3. **Then** the installed app opens with usable navigation and correct account state

Result: Not run. Evidence: —

## TC_UX_008 Offline save behaviour

P1 | Manual | Feedback mobile accessibility and installation

1. **Given** the device loses connectivity while a form is open
2. **When** the user saves and later reconnects
3. **Then** failure is honest and recovery permits a retry without implying unsupported offline sync

Result: Not run. Evidence: —

## TC_UX_009 Dashboard counts

P1 | Manual | Feedback mobile accessibility and installation

1. **Given** administrator A reviewed applications and saved school records
2. **When** the dashboard and source lists are refreshed
3. **Then** counts agree for School A and exclude School B private data

Result: Not run. Evidence: —

## TC_UX_010 Context cleanup

P1 | Manual | Feedback mobile accessibility and installation

1. **Given** a private detail or save notification is visible
2. **When** the user navigates away or switches accounts
3. **Then** stale notifications and prior-account data do not reappear

Result: Not run. Evidence: —

## TC_STAFF_001 Invite and join a teacher

P0 | Manual | Staff register invitations and access

1. **Given** administrator A has created a staff record with a unique example.test email
2. **When** they invite that email and the recipient signs up, confirms email and redeems the code
3. **Then** the recipient has staff access to School A and appears in its access list

Result: Not run. Evidence: —

## TC_STAFF_002 Private staff documents

P0 | Manual | Staff register invitations and access

1. **Given** administrator A uploaded a fictional qualification file
2. **When** the administrator opens it and a teacher, parent and School B user request the same file
3. **Then** only the authorised administrator can read the private document

Result: Not run. Evidence: —

## TC_STAFF_003 Invitation email binding and reuse

P1 | Manual | Staff register invitations and access

1. **Given** an unused invitation is bound to one email
2. **When** another email attempts redemption and then the intended account redeems the invitation twice
3. **Then** the other email is denied and exactly one membership is created

Result: Not run. Evidence: —

## TC_STAFF_004 Expired invitation

P1 | Manual | Staff register invitations and access

1. **Given** an invitation has an expiry date in the past
2. **When** the intended account redeems it
3. **Then** the code is rejected with a readable error and no membership is created

Result: Not run. Evidence: —

## TC_STAFF_005 Role change

P1 | Manual | Staff register invitations and access

1. **Given** a fictional staff account belongs to School A
2. **When** administrator A changes its role and that user starts a fresh session
3. **Then** navigation and API permissions match the new role without changing School B

Result: Not run. Evidence: —

## TC_TIME_001 Place a lesson

P0 | Manual | Teacher and class timetable

1. **Given** school day periods and teaching assignments exist
2. **When** an authorised user schedules Teacher A for Mathematics in Grade 3 A
3. **Then** the saved lesson appears in both teacher and class views after refresh

Result: Not run. Evidence: —

## TC_TIME_002 Reject conflicts

P0 | Manual | Teacher and class timetable

1. **Given** Teacher A already has a lesson in a slot
2. **When** another lesson uses the same teacher or class at that time
3. **Then** the conflict is rejected and the existing lesson remains

Result: Not run. Evidence: —

## TC_TIME_003 Remove lessons and periods

P1 | Manual | Teacher and class timetable

1. **Given** a saved lesson uses a school period
2. **When** an authorised user removes the lesson or its period
3. **Then** dependency rules are explained and all timetable views remain consistent

Result: Not run. Evidence: —

## TC_TIME_004 Calendar export

P1 | Manual | Teacher and class timetable

1. **Given** Teacher A has saved lessons
2. **When** they export the timetable
3. **Then** the calendar file includes correct lessons and times without another school’s data

Result: Not run. Evidence: —
