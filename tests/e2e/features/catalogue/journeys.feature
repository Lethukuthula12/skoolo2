@manual @journey
Feature: Complete school teacher and family journeys
  Start from a fresh local reset. Each journey is independent.
  Manual verification uses the accounts and preparation notes in the new laptop guide.

  @TC_JOURNEY_001 @P0
  Scenario: A new school welcomes an applying family
    Given a new principal and parent use unique local example.test emails
    When the principal registers and confirms a school
    And the local operator verifies that fictional school
    And its administrator sets the profile, fictional bank details, Grade 3 intake and class
    And the parent confirms an account, finds the school and submits an application
    And the parent uploads documents and declares the EFT payment
    And the administrator reviews documents, confirms payment and places the learner in the class
    And the administrator shares a family code which the parent redeems
    Then the application is accepted and payment confirmed
    And the parent receives the welcome message and sees the correct linked learner
    And there is exactly one application, payment confirmation and family link

  @TC_JOURNEY_002 @P0
  Scenario: A teacher prepares an assessment and a parent receives results
    Given a school has an administrator, assigned teacher, class, subjects and linked family
    When the teacher drafts a question paper and sends it for review
    And the administrator returns it with feedback
    And the teacher corrects and resubmits it and the administrator approves
    And the teacher prints the learner paper and memorandum separately
    And the teacher creates its assessment and captures learner marks
    And the teacher prepares term reports and the administrator approves and publishes them
    Then the parent can read the correct published results after reopening the app
    And the approved paper and published report remain protected from direct edits

  @TC_JOURNEY_003 @P0
  Scenario: Family and teacher complete daily communication
    Given parent A is linked to Learner A in Teacher A's class
    When the parent reports an absence and the school acknowledges it
    And Teacher A saves the daily attendance register
    And the parent starts a message thread and the teacher replies
    And administrator A publishes a school notice and calendar event
    Then parent A sees the correct attendance, conversation, notice and event after reopening
    And unrelated families cannot see Learner A's private information
