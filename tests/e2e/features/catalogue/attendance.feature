@manual @attendance
Feature: Attendance and absence reporting
  Start with local:reset and the fictional accounts in docs/testing/new-laptop.md.
  Prepare each scenario independently using the Given condition.

  @TC_ATT_001 @P0
  Scenario: Register reaches the parent
    Given Teacher A opens the class register for today
    When they mark Learner A absent with a note and save
    Then the value persists and parent A sees the matching attendance date and status

  @TC_ATT_002 @P0
  Scenario: Report and acknowledge absence
    Given parent A opens Report absence for Learner A
    When they submit dates and a reason and the school acknowledges the note
    Then the note reaches authorised school staff and its acknowledgement is saved

  @TC_ATT_003 @P1
  Scenario: Invalid absence dates
    Given an absence form is open
    When the end date precedes the start date or the reason is empty
    Then validation prevents submission and identifies the problem

  @TC_ATT_004 @P1
  Scenario: Correct the same attendance record
    Given a learner already has an attendance record for today
    When the teacher saves a corrected status for the same date
    Then one record remains with the corrected status after refresh

  @TC_ATT_005 @P1
  Scenario: Deny unrelated attendance access
    Given an unassigned teacher and parent B sign in separately
    When they read or write Learner A attendance
    Then the database denies unauthorised access
