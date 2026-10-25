@manual @calendar
Feature: School calendar
  Start with local:reset and the fictional accounts in docs/testing/new-laptop.md.
  Prepare each scenario independently using the Given condition.

  @TC_CAL_001 @P0
  Scenario: School event reaches parents
    Given administrator A creates a school event with date and time
    When parent A and parent B open calendars
    Then A sees the correct event and B cannot see School A private events

  @TC_CAL_002 @P0
  Scenario: Class event audience
    Given an event is restricted to Grade 3 A
    When linked and unrelated parents open calendars
    Then only its permitted audience sees the event

  @TC_CAL_003 @P1
  Scenario: Edit and delete event
    Given an authorised school user created an event
    When they change its date and later delete it
    Then each saved change reaches school and parent views after refresh

  @TC_CAL_004 @P1
  Scenario: Date and time validation
    Given an event editor is open
    When the user enters missing details or invalid time ranges and then corrects them
    Then invalid data is rejected and valid timed and all-day events display correctly in South African time
