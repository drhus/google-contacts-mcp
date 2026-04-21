#!/usr/bin/env ruby
# frozen_string_literal: true
# Ruby 3.3.7 required for google-apis-people_v1 gem

# Google Contacts Manager Script
#
# Purpose: Manage Google Contacts with full CRUD operations
# Usage: See --help for detailed command examples
# Output: JSON with results or error information
# Exit codes: 0=success, 1=operation failed, 2=auth error, 3=api error, 4=invalid args

require 'optparse'
require 'json'
require 'fileutils'
require 'shellwords'
require 'google/apis/people_v1'
require 'google/apis/calendar_v3'
require 'googleauth'
require 'googleauth/stores/file_token_store'

# Script version
VERSION = '1.1.0'

# Configuration constants
CONTACTS_SCOPE = Google::Apis::PeopleV1::AUTH_CONTACTS
CALENDAR_SCOPE = Google::Apis::CalendarV3::AUTH_CALENDAR
CREDENTIALS_PATH = File.join(Dir.home, '.claude', '.google', 'client_secret.json')
TOKEN_PATH = File.join(Dir.home, '.claude', '.google', 'token.json')
REDIRECT_URI = 'http://localhost:8080'

# Authorize with Google OAuth 2.0
def authorize
  require 'webrick'

  # Check if credentials file exists
  unless File.exist?(CREDENTIALS_PATH)
    return {
      status: 'error',
      code: 'AUTH_ERROR',
      message: "Credentials file not found at #{CREDENTIALS_PATH}"
    }
  end

  # Load client secrets
  begin
    client_id = Google::Auth::ClientId.from_file(CREDENTIALS_PATH)
  rescue => e
    return {
      status: 'error',
      code: 'AUTH_ERROR',
      message: "Failed to load credentials: #{e.message}"
    }
  end

  # Create token store with both calendar and contacts scopes
  token_store = Google::Auth::Stores::FileTokenStore.new(file: TOKEN_PATH)
  authorizer = Google::Auth::UserAuthorizer.new(
    client_id,
    [CALENDAR_SCOPE, CONTACTS_SCOPE],
    token_store,
    REDIRECT_URI
  )

  # Get user credentials
  user_id = 'default'
  credentials = authorizer.get_credentials(user_id)

  # If no valid credentials, start local server to capture OAuth code
  if credentials.nil?
    url = authorizer.get_authorization_url(base_url: REDIRECT_URI)

    puts "Open the following URL in your browser to authorize:"
    puts url
    puts "\nWaiting for authorization on http://localhost:8080 ..."

    # Try to open browser automatically
    system("xdg-open '#{url}' 2>/dev/null || open '#{url}' 2>/dev/null || true")

    # Start local server to capture the redirect with the auth code
    code = nil
    server = WEBrick::HTTPServer.new(
      Port: 8080,
      Logger: WEBrick::Log.new('/dev/null'),
      AccessLog: []
    )
    server.mount_proc '/' do |req, res|
      code = req.query['code']
      res.body = '<html><body><h2>Authorization successful! You can close this tab.</h2></body></html>'
      res.content_type = 'text/html'
      server.shutdown
    end
    server.start

    if code.nil?
      return {
        status: 'error',
        code: 'AUTH_ERROR',
        message: 'No authorization code received'
      }
    end

    begin
      credentials = authorizer.get_and_store_credentials_from_code(
        user_id: user_id,
        code: code,
        base_url: REDIRECT_URI
      )
    rescue => e
      return {
        status: 'error',
        code: 'AUTH_ERROR',
        message: "Authorization failed: #{e.message}"
      }
    end
  end

  # Automatically refresh token if expired
  begin
    credentials.refresh! if credentials.expired?
  rescue => e
    return {
      status: 'error',
      code: 'AUTH_ERROR',
      message: "Token refresh failed: #{e.message}"
    }
  end

  credentials
end

# Initialize People service, returns [service, credentials]
def init_service
  credentials = authorize
  return [credentials, nil] if credentials.is_a?(Hash) && credentials[:status] == 'error'

  service = Google::Apis::PeopleV1::PeopleServiceService.new
  service.authorization = credentials
  [service, credentials]
end

# Normalize phone number to digits only for comparison
# Also removes leading '1' (US country code) for better matching
def normalize_phone(phone)
  return '' if phone.nil?
  # Remove all non-digit characters
  digits = phone.gsub(/\D/, '')
  # Remove leading '1' if present (US country code)
  # This allows matching "+1 (619) 846-1019" with "619-846-1019"
  digits = digits.sub(/^1/, '') if digits.length == 11 && digits.start_with?('1')
  digits
end

# Normalize text by removing diacritics/accents for accent-insensitive matching
# This allows "Zoe" to match "Zoë", "Jose" to match "José", etc.
def normalize_diacritics(text)
  return '' if text.nil?
  # Use Unicode normalization (NFD) to decompose characters, then remove combining marks
  text.unicode_normalize(:nfd).gsub(/\p{Mn}/, '')
end

# Search contacts by name, email, or phone (client-side filtering)
def search_contacts(service, query)
  begin
    # List all contacts and filter client-side
    response = service.list_person_connections(
      'people/me',
      person_fields: 'names,emailAddresses,phoneNumbers,organizations,birthdays,addresses,biographies,urls',
      page_size: 1000  # Get up to 1000 contacts for search
    )

    contacts = []
    query_lower = query.downcase
    # Normalize query for phone number search (remove all non-digits)
    query_normalized = normalize_phone(query)
    # Normalize query for accent-insensitive name matching
    query_normalized_accents = normalize_diacritics(query_lower)

    if response.connections
      response.connections.each do |person|
        # Search in display name, given name, family name, email, and phone
        match = false

        # Search in names (with accent-insensitive matching)
        if person.names && !person.names.empty?
          name = person.names.first
          # Check both exact match and accent-normalized match
          match = true if name.display_name&.downcase&.include?(query_lower)
          match = true if name.given_name&.downcase&.include?(query_lower)
          match = true if name.family_name&.downcase&.include?(query_lower)
          # Also check accent-normalized versions
          match = true if normalize_diacritics(name.display_name&.downcase || '').include?(query_normalized_accents)
          match = true if normalize_diacritics(name.given_name&.downcase || '').include?(query_normalized_accents)
          match = true if normalize_diacritics(name.family_name&.downcase || '').include?(query_normalized_accents)
        end

        # Search in email addresses
        if !match && person.email_addresses && !person.email_addresses.empty?
          person.email_addresses.each do |email|
            match = true if email.value&.downcase&.include?(query_lower)
          end
        end

        # Search in phone numbers (normalize both query and stored numbers)
        if !match && person.phone_numbers && !person.phone_numbers.empty? && !query_normalized.empty?
          person.phone_numbers.each do |phone|
            normalized_phone = normalize_phone(phone.value)
            # Match if the normalized query is contained in the normalized phone number
            # This handles cases like searching "6198461019" or "+16198461019" or "(619) 846-1019"
            match = true if normalized_phone.include?(query_normalized)
          end
        end

        contacts << format_contact(person) if match
      end
    end

    {
      status: 'success',
      count: contacts.length,
      contacts: contacts
    }
  rescue => e
    {
      status: 'error',
      code: 'API_ERROR',
      message: "Search failed: #{e.message}"
    }
  end
end

# Get contact by resource name
def get_contact(service, resource_name)
  begin
    person = service.get_person(
      resource_name,
      person_fields: 'names,emailAddresses,phoneNumbers,organizations,birthdays,addresses,biographies,urls,photos,metadata'
    )

    {
      status: 'success',
      contact: format_contact(person)
    }
  rescue => e
    {
      status: 'error',
      code: 'API_ERROR',
      message: "Get contact failed: #{e.message}"
    }
  end
end

# List contacts with optional filtering
def list_contacts(service, page_size = 100, page_token = nil)
  begin
    response = service.list_person_connections(
      'people/me',
      person_fields: 'names,emailAddresses,phoneNumbers,organizations,birthdays,addresses,biographies,urls',
      page_size: page_size,
      page_token: page_token
    )

    contacts = []
    if response.connections
      response.connections.each do |person|
        contacts << format_contact(person)
      end
    end

    {
      status: 'success',
      count: contacts.length,
      contacts: contacts,
      next_page_token: response.next_page_token
    }
  rescue => e
    {
      status: 'error',
      code: 'API_ERROR',
      message: "List contacts failed: #{e.message}"
    }
  end
end

# Create new contact
def create_contact(service, data)
  begin
    person = Google::Apis::PeopleV1::Person.new

    # Add names
    if data['name']
      person.names = [
        Google::Apis::PeopleV1::Name.new(
          given_name: data['name']['given_name'],
          family_name: data['name']['family_name'],
          display_name: data['name']['display_name']
        )
      ]
    end

    # Add emails
    if data['emails']
      person.email_addresses = data['emails'].map do |email|
        Google::Apis::PeopleV1::EmailAddress.new(
          value: email['value'],
          type: email['type'] || 'home'
        )
      end
    end

    # Add phone numbers
    if data['phones']
      person.phone_numbers = data['phones'].map do |phone|
        Google::Apis::PeopleV1::PhoneNumber.new(
          value: phone['value'],
          type: phone['type'] || 'mobile'
        )
      end
    end

    # Add organization
    if data['organization']
      person.organizations = [
        Google::Apis::PeopleV1::Organization.new(
          name: data['organization']['name'],
          title: data['organization']['title']
        )
      ]
    end

    # Add birthday
    if data['birthday']
      person.birthdays = [
        Google::Apis::PeopleV1::Birthday.new(
          date: Google::Apis::PeopleV1::Date.new(
            year: data['birthday']['year'],
            month: data['birthday']['month'],
            day: data['birthday']['day']
          )
        )
      ]
    end

    # Add addresses
    if data['addresses']
      person.addresses = data['addresses'].map do |address|
        Google::Apis::PeopleV1::Address.new(
          street_address: address['street'],
          city: address['city'],
          region: address['state'],
          postal_code: address['zip'],
          country: address['country'],
          type: address['type'] || 'home'
        )
      end
    end

    # Add URLs
    if data['urls']
      person.urls = data['urls'].map do |url|
        Google::Apis::PeopleV1::Url.new(
          value: url['value'],
          type: url['type'] || 'other'
        )
      end
    end

    # Add notes/biography with creation log
    log_entry = "• #{Time.now.strftime('%Y-%m-%d')}: contact created"
    base_notes = data['notes'] || ''
    full_notes = append_log_to_notes(base_notes, log_entry)
    person.biographies = [Google::Apis::PeopleV1::Biography.new(value: full_notes)]

    created_person = service.create_person_contact(person)

    {
      status: 'success',
      message: 'Contact created successfully',
      contact: format_contact(created_person)
    }
  rescue => e
    {
      status: 'error',
      code: 'API_ERROR',
      message: "Create contact failed: #{e.message}"
    }
  end
end

# Update existing contact
def update_contact(service, resource_name, data, update_mask)
  begin
    # First get the current contact
    person = service.get_person(
      resource_name,
      person_fields: 'names,emailAddresses,phoneNumbers,organizations,birthdays,addresses,biographies,urls,photos,metadata'
    )

    # Update fields based on data provided
    if data['name']
      person.names ||= []
      if person.names.empty?
        person.names << Google::Apis::PeopleV1::Name.new
      end
      person.names[0].given_name = data['name']['given_name'] if data['name']['given_name']
      person.names[0].family_name = data['name']['family_name'] if data['name']['family_name']
      person.names[0].display_name = data['name']['display_name'] if data['name']['display_name']
    end

    if data['emails']
      person.email_addresses = data['emails'].map do |email|
        Google::Apis::PeopleV1::EmailAddress.new(
          value: email['value'],
          type: email['type'] || 'home'
        )
      end
    end

    if data['phones']
      person.phone_numbers = data['phones'].map do |phone|
        Google::Apis::PeopleV1::PhoneNumber.new(
          value: phone['value'],
          type: phone['type'] || 'mobile'
        )
      end
    end

    if data['organization']
      person.organizations ||= []
      if person.organizations.empty?
        person.organizations << Google::Apis::PeopleV1::Organization.new
      end
      person.organizations[0].name = data['organization']['name'] if data['organization']['name']
      person.organizations[0].title = data['organization']['title'] if data['organization']['title']
    end

    if data['birthday']
      person.birthdays ||= []
      if person.birthdays.empty?
        person.birthdays << Google::Apis::PeopleV1::Birthday.new(
          date: Google::Apis::PeopleV1::Date.new
        )
      end
      person.birthdays[0].date.year = data['birthday']['year'] if data['birthday']['year']
      person.birthdays[0].date.month = data['birthday']['month'] if data['birthday']['month']
      person.birthdays[0].date.day = data['birthday']['day'] if data['birthday']['day']
    end

    if data['addresses']
      person.addresses = data['addresses'].map do |address|
        Google::Apis::PeopleV1::Address.new(
          street_address: address['street'],
          city: address['city'],
          region: address['state'],
          postal_code: address['zip'],
          country: address['country'],
          type: address['type'] || 'home'
        )
      end
    end

    if data['notes']
      person.biographies ||= []
      if person.biographies.empty?
        person.biographies << Google::Apis::PeopleV1::Biography.new
      end
      person.biographies[0].value = data['notes']
    end

    if data['urls']
      person.urls = data['urls'].map do |url|
        Google::Apis::PeopleV1::Url.new(
          value: url['value'],
          type: url['type'] || 'other'
        )
      end
    end

    # Append activity log to notes
    mask_fields = update_mask.split(',').map(&:strip)
    log_entry = build_log_entry(mask_fields - ['biographies'])
    person.biographies ||= []
    person.biographies << Google::Apis::PeopleV1::Biography.new if person.biographies.empty?
    current_notes = person.biographies[0].value || ''
    person.biographies[0].value = append_log_to_notes(current_notes, log_entry)
    unless mask_fields.include?('biographies')
      update_mask = (mask_fields + ['biographies']).join(',')
    end

    updated_person = service.update_person_contact(
      resource_name,
      person,
      update_person_fields: update_mask
    )

    {
      status: 'success',
      message: 'Contact updated successfully',
      contact: format_contact(updated_person)
    }
  rescue => e
    {
      status: 'error',
      code: 'API_ERROR',
      message: "Update contact failed: #{e.message}"
    }
  end
end

# Update contact photo from local file or URL, with auto-compression if > 2MB
def update_contact_photo(service, credentials, resource_name, options)
  require 'base64'
  require 'tempfile'
  require 'net/http'
  require 'open-uri'

  max_bytes = 2 * 1024 * 1024 # 2MB

  begin
    # Step 1: Get image from file or URL
    if options[:photo_file]
      raise "File not found: #{options[:photo_file]}" unless File.exist?(options[:photo_file])
      src = options[:photo_file]
    elsif options[:photo_url]
      tmp_download = Tempfile.new(['contact_photo_src', '.jpg'])
      tmp_download.binmode
      URI.open(options[:photo_url], 'rb') { |f| tmp_download.write(f.read) }
      tmp_download.close
      src = tmp_download.path
    else
      return { status: 'error', code: 'INVALID_ARGS', message: 'Provide --photo-file or --photo-url' }
    end

    # Step 2: Copy to work file (convert to JPEG)
    work_file = Tempfile.new(['contact_photo_work', '.jpg'])
    work_file.close
    system("convert #{src.shellescape} #{work_file.path.shellescape}")

    # Step 3: Auto-compress if > 2MB
    quality = 85
    loop do
      break if File.size(work_file.path) <= max_bytes

      if quality >= 40
        compressed = Tempfile.new(['contact_photo_compressed', '.jpg'])
        compressed.close
        system("convert #{work_file.path.shellescape} -quality #{quality} #{compressed.path.shellescape}")
        work_file = compressed
        quality -= 15
      else
        resized = Tempfile.new(['contact_photo_resized', '.jpg'])
        resized.close
        system("convert #{work_file.path.shellescape} -resize 50% #{resized.path.shellescape}")
        work_file = resized
        break
      end
    end

    # Step 4: Base64 encode and call API
    photo_bytes = Base64.strict_encode64(File.binread(work_file.path))
    token = credentials.access_token
    uri = URI("https://people.googleapis.com/v1/#{resource_name}:updateContactPhoto")
    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl = true
    req = Net::HTTP::Patch.new(uri)
    req['Authorization'] = "Bearer #{token}"
    req['Content-Type'] = 'application/json'
    req.body = { photoBytes: photo_bytes }.to_json
    response = JSON.parse(http.request(req).body)

    return { status: 'error', code: 'API_ERROR', message: response['error']['message'] } if response['error']

    append_activity_log(service, resource_name, "• #{Time.now.strftime('%Y-%m-%d')}: photo updated")

    { status: 'success', message: 'Contact photo updated successfully', resource_name: resource_name }
  rescue => e
    { status: 'error', code: 'API_ERROR', message: "Photo update failed: #{e.message}" }
  end
end

# Build a short activity log entry for the notes field
def build_log_entry(mask_fields)
  date = Time.now.strftime('%Y-%m-%d')
  field_map = {
    'names'          => 'name',
    'emailAddresses' => 'email',
    'phoneNumbers'   => 'phone',
    'organizations'  => 'org',
    'urls'           => 'URLs',
    'addresses'      => 'address',
    'birthdays'      => 'birthday'
  }
  parts = mask_fields.filter_map { |f| field_map[f] }
  description = parts.empty? ? 'updated' : "#{parts.join(', ')} updated"
  "• #{date}: #{description}"
end

# Append a log line to notes, ensuring the "--\nlogs:" section header exists
def append_log_to_notes(current_notes, log_line)
  log_header = "--\nlogs:"
  if current_notes.include?(log_header)
    "#{current_notes}\n#{log_line}"
  elsif current_notes.empty?
    "#{log_header}\n#{log_line}"
  else
    "#{current_notes}\n#{log_header}\n#{log_line}"
  end
end

# Append a log entry to a contact's notes (used for photo updates and other standalone ops)
def append_activity_log(service, resource_name, log_text)
  person = service.get_person(resource_name, person_fields: 'biographies,metadata')
  person.biographies ||= []
  person.biographies << Google::Apis::PeopleV1::Biography.new if person.biographies.empty?
  current = person.biographies[0].value || ''
  person.biographies[0].value = append_log_to_notes(current, log_text)
  service.update_person_contact(resource_name, person, update_person_fields: 'biographies')
rescue => e
  # Non-fatal — don't fail the main operation if log append fails
end

# List contact groups (labels), excluding system groups
def list_groups(credentials)
  require 'net/http'
  token = credentials.access_token
  uri = URI('https://people.googleapis.com/v1/contactGroups?pageSize=200')
  http = Net::HTTP.new(uri.host, uri.port)
  http.use_ssl = true
  req = Net::HTTP::Get.new(uri)
  req['Authorization'] = "Bearer #{token}"
  response = JSON.parse(http.request(req).body)
  return { status: 'error', code: 'API_ERROR', message: response['error']['message'] } if response['error']

  system_groups = %w[myContacts starred all blocked friends family coworkers]
  groups = (response['contactGroups'] || []).reject do |g|
    g['groupType'] == 'SYSTEM_CONTACT_GROUP' || system_groups.include?(g['name'])
  end.map do |g|
    { resource_name: g['resourceName'], name: g['name'], member_count: g['memberCount'].to_i }
  end

  { status: 'success', groups: groups }
rescue => e
  { status: 'error', code: 'API_ERROR', message: "List groups failed: #{e.message}" }
end

# Add a contact to a group (label)
def add_to_group(credentials, group_resource_name, contact_resource_name)
  require 'net/http'
  token = credentials.access_token
  uri = URI("https://people.googleapis.com/v1/#{group_resource_name}/members:modify")
  http = Net::HTTP.new(uri.host, uri.port)
  http.use_ssl = true
  req = Net::HTTP::Post.new(uri)
  req['Authorization'] = "Bearer #{token}"
  req['Content-Type'] = 'application/json'
  req.body = { resourceNamesToAdd: [contact_resource_name] }.to_json
  response = JSON.parse(http.request(req).body)
  return { status: 'error', code: 'API_ERROR', message: response['error']['message'] } if response['error']

  { status: 'success', message: "Contact added to group successfully" }
rescue => e
  { status: 'error', code: 'API_ERROR', message: "Add to group failed: #{e.message}" }
end

# Delete contact
def delete_contact(service, resource_name)
  begin
    service.delete_person_contact(resource_name)

    {
      status: 'success',
      message: 'Contact deleted successfully',
      resource_name: resource_name
    }
  rescue => e
    {
      status: 'error',
      code: 'API_ERROR',
      message: "Delete contact failed: #{e.message}"
    }
  end
end

# Format contact data for output
def format_contact(person)
  contact = {
    resource_name: person.resource_name
  }

  # Names
  if person.names && !person.names.empty?
    name = person.names.first
    contact[:name] = {
      display_name: name.display_name,
      given_name: name.given_name,
      family_name: name.family_name
    }
  end

  # Email addresses
  if person.email_addresses && !person.email_addresses.empty?
    contact[:emails] = person.email_addresses.map do |email|
      {
        value: email.value,
        type: email.type
      }
    end
  end

  # Phone numbers
  if person.phone_numbers && !person.phone_numbers.empty?
    contact[:phones] = person.phone_numbers.map do |phone|
      {
        value: phone.value,
        type: phone.type
      }
    end
  end

  # Organizations
  if person.organizations && !person.organizations.empty?
    org = person.organizations.first
    contact[:organization] = {
      name: org.name,
      title: org.title
    }
  end

  # Birthdays
  if person.birthdays && !person.birthdays.empty?
    birthday = person.birthdays.first
    if birthday.date
      contact[:birthday] = {
        year: birthday.date.year,
        month: birthday.date.month,
        day: birthday.date.day
      }
    end
  end

  # Addresses
  if person.addresses && !person.addresses.empty?
    contact[:addresses] = person.addresses.map do |address|
      {
        street: address.street_address,
        city: address.city,
        state: address.region,
        zip: address.postal_code,
        country: address.country,
        type: address.type
      }
    end
  end

  # Biography/Notes
  if person.biographies && !person.biographies.empty?
    contact[:notes] = person.biographies.first.value
  end

  # Photo — true only if a real (non-default) photo is set
  contact[:has_photo] = person.photos&.any? { |p| !p.default } || false

  # URLs
  if person.urls && !person.urls.empty?
    contact[:urls] = person.urls.map do |url|
      {
        value: url.value,
        type: url.type
      }
    end
  end

  contact
end

# Main execution
def main
  options = {}

  OptionParser.new do |opts|
    opts.banner = "Usage: contacts_manager.rb [options]"

    opts.on("--search QUERY", "Search contacts by name") do |q|
      options[:action] = :search
      options[:query] = q
    end

    opts.on("--get RESOURCE_NAME", "Get contact by resource name") do |r|
      options[:action] = :get
      options[:resource_name] = r
    end

    opts.on("--list", "List all contacts") do
      options[:action] = :list
    end

    opts.on("--page-size SIZE", Integer, "Number of contacts per page (default: 100)") do |s|
      options[:page_size] = s
    end

    opts.on("--page-token TOKEN", "Page token for pagination") do |t|
      options[:page_token] = t
    end

    opts.on("--create DATA", "Create new contact (JSON)") do |d|
      options[:action] = :create
      options[:data] = JSON.parse(d)
    end

    opts.on("--update RESOURCE_NAME", "Update contact by resource name") do |r|
      options[:action] = :update
      options[:resource_name] = r
    end

    opts.on("--update-data DATA", "Update data (JSON)") do |d|
      options[:update_data] = JSON.parse(d)
    end

    opts.on("--update-mask MASK", "Update mask (comma-separated fields)") do |m|
      options[:update_mask] = m
    end

    opts.on("--update-photo RESOURCE_NAME", "Update contact photo") do |r|
      options[:action] = :update_photo
      options[:resource_name] = r
    end

    opts.on("--photo-file PATH", "Local image file path for photo update") do |p|
      options[:photo_file] = p
    end

    opts.on("--photo-url URL", "Remote image URL for photo update") do |u|
      options[:photo_url] = u
    end

    opts.on("--list-groups", "List all user-defined contact groups (labels)") do
      options[:action] = :list_groups
    end

    opts.on("--add-to-group GROUP_RESOURCE_NAME", "Add contact to a group (label)") do |g|
      options[:action] = :add_to_group
      options[:group_resource_name] = g
    end

    opts.on("--contact-resource CONTACT_RESOURCE_NAME", "Contact resource name for group operations") do |r|
      options[:contact_resource_name] = r
    end

    opts.on("--delete RESOURCE_NAME", "Delete contact by resource name") do |r|
      options[:action] = :delete
      options[:resource_name] = r
    end

    opts.on("-v", "--version", "Show version") do
      puts "Google Contacts Manager - Version #{VERSION}"
      exit 0
    end

    opts.on("-h", "--help", "Show this help message") do
      puts opts
      puts "\nExamples:"
      puts "  Search: contacts_manager.rb --search 'John Smith'"
      puts "  List:   contacts_manager.rb --list --page-size 50"
      puts "  Get:    contacts_manager.rb --get 'people/c1234567890'"
      puts "  Create: contacts_manager.rb --create '{\"name\":{\"given_name\":\"John\",\"family_name\":\"Doe\"},\"emails\":[{\"value\":\"john@example.com\"}]}'"
      puts "  Update: contacts_manager.rb --update 'people/c1234567890' --update-data '{\"phones\":[{\"value\":\"555-1234\"}]}' --update-mask 'phoneNumbers'"
      puts "  Delete: contacts_manager.rb --delete 'people/c1234567890'"
      exit 0
    end
  end.parse!

  # Initialize service
  service, credentials = init_service
  if service.is_a?(Hash) && service[:status] == 'error'
    puts JSON.pretty_generate(service)
    exit 2
  end

  # Execute action
  result = case options[:action]
  when :search
    search_contacts(service, options[:query])
  when :get
    get_contact(service, options[:resource_name])
  when :list
    list_contacts(service, options[:page_size] || 100, options[:page_token])
  when :create
    create_contact(service, options[:data])
  when :update
    update_contact(service, options[:resource_name], options[:update_data], options[:update_mask])
  when :update_photo
    update_contact_photo(service, credentials, options[:resource_name], options)
  when :list_groups
    list_groups(credentials)
  when :add_to_group
    add_to_group(credentials, options[:group_resource_name], options[:contact_resource_name])
  when :delete
    delete_contact(service, options[:resource_name])
  else
    {
      status: 'error',
      code: 'INVALID_ARGS',
      message: 'No action specified. Use --help for usage information.'
    }
  end

  puts JSON.pretty_generate(result)
  exit(result[:status] == 'success' ? 0 : 1)
end

main if __FILE__ == $PROGRAM_NAME
