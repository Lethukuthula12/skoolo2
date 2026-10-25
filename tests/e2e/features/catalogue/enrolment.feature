@manual @enrolment
Feature: Enrolment from directory to school decision
  Start with local:reset and the fictional accounts in docs/testing/new-laptop.md.
  Prepare each scenario independently using the Given condition.

  @TC_ENROL_001 @P0
  Scenario: Submit application and documents
    Given a confirmed parent finds Test School A with Grade 3 capacity
    When they submit valid learner, guardian, address and consent details and upload fictional required documents
    Then one submitted application with a unique reference appears and administrator A can review the same records

  @TC_ENROL_002 @P0
  Scenario: Declare EFT and confirm payment
    Given a submitted application has unpaid status
    When the parent marks EFT paid and administrator A later confirms it
    Then status first becomes marked paid, then confirmed and accepted with a welcome message to the parent

  @TC_ENROL_003 @P1
  Scenario: Request missing information
    Given administrator A is reviewing an application
    When they request a missing document and the parent uploads it
    Then the parent sees the request and the administrator can review the replacement before deciding

  @TC_ENROL_004 @P1
  Scenario: Reject duplicate applications
    Given a learner has an active application for School A in the selected year
    When the parent submits another for the same learner, school and year
    Then the duplicate is rejected and capacity is not consumed twice

  @TC_ENROL_005 @P1
  Scenario: Closed and full grades
    Given Grade 1 is closed and Grade 4 has zero capacity in the local intake
    When a parent attempts to apply to either grade
    Then submission is refused without creating an application

  @TC_ENROL_006 @P1
  Scenario: Last place race
    Given exactly one place remains in an open grade
    When two parents submit valid applications concurrently
    Then one application receives the place and the other gets a capacity error

  @TC_ENROL_007 @P1
  Scenario: Withdraw and release capacity
    Given an active application holds one grade place
    When its parent withdraws and confirms the action
    Then the application becomes withdrawn and capacity increases exactly once

  @TC_ENROL_008 @P1
  Scenario: Decline and waitlist
    Given administrator A reviews two submitted applications
    When one is declined and the other waitlisted
    Then parents see the correct decisions and only the declined application releases its place

  @TC_ENROL_009 @P1
  Scenario: Invalid transition
    Given an application is in a terminal state
    When an administrator requests a transition outside the permitted status rules
    Then the transition is rejected and saved state and history remain unchanged

  @TC_ENROL_010 @P1
  Scenario: Unsupported file and replacement
    Given a parent opens application documents
    When they select an unsupported or oversized file and then a supported replacement
    Then the invalid upload is rejected and the replacement is available only to authorised users

  @TC_ENROL_011 @P1
  Scenario: Teachers have no enrolment access
    Given Teacher A is signed in
    When they open application, payment queue and private applicant document URLs or API requests
    Then no applicant details or documents are disclosed

  @TC_ENROL_012 @P1
  Scenario: Submission failure and retry
    Given a completed application form is ready
    When the API fails during submission and the parent retries after recovery
    Then the failure is visible and exactly one successful application is created
