<?php

namespace App\Database\Seeds\Factories\Providers;

use Faker\Provider\Base;

/**
 * ZimbabweanProvider
 *
 * Custom Faker provider for Zimbabwe-specific data:
 * Shona/Ndebele names, Harare addresses, +263 phone numbers,
 * and school-specific vocabulary.
 */
class ZimbabweanProvider extends Base
{
    protected static array $shonaFirstNames = [
        'Tinashe', 'Rumbidzai', 'Tatenda', 'Tariro', 'Chiedza', 'Takudzwa',
        'Simbarashe', 'Tinotenda', 'Fadzai', 'Tafadzwa', 'Ngonidzashe',
        'Tawanda', 'Patience', 'Tendai', 'Nyasha', 'Tapiwa', 'Ruvimbo',
        'Blessing', 'Tanaka', 'Tafara', 'Kudzai', 'Tarisai', 'Rudo',
        'Munyaradzi', 'Munashe', 'Makomborero', 'Farai', 'Chenai',
        'Tinevimbo', 'Tonderai', 'Zvichapera', 'Shingai', 'Sekai',
    ];

    protected static array $ndebeleFirstNames = [
        'Nkosi', 'Sithembile', 'Lungelo', 'Sibongile', 'Nhlanhla', 'Thulani',
        'Sifiso', 'Nomvula', 'Bongani', 'Lindiwe', 'Mthokozisi', 'Zanele',
        'Nkosilathi', 'Sibusiso', 'Ntombizodwa', 'Lwazi', 'Menzi',
    ];

    protected static array $zimbabweanLastNames = [
        'Moyo', 'Ndlovu', 'Dube', 'Mpofu', 'Nkomo', 'Sibanda', 'Mhlanga',
        'Ncube', 'Moyo', 'Khumalo', 'Maphosa', 'Nyoni', 'Tshuma',
        'Chikwanda', 'Mutasa', 'Muzenda', 'Makoni', 'Chigumba', 'Mapuranga',
        'Nhamo', 'Zenda', 'Sithole', 'Gumbo', 'Choto', 'Mhaka', 'Mlambo',
        'Chipunza', 'Chikomo', 'Murwira', 'Manyika', 'Mufara', 'Chiduku',
        'Maenzanise', 'Mwale', 'Chikafa', 'Chikomba', 'Rusike', 'Mavhura',
    ];

    protected static array $harareSuburbs = [
        'Borrowdale', 'Avondale', 'Mount Pleasant', 'Highlands', 'Mbare',
        'Chitungwiza', 'Glen Norah', 'Glen View', 'Warren Park', 'Kuwadzana',
        'Budiriro', 'Epworth', 'Hatfield', 'Greendale', 'Msasa', 'Eastlea',
        'Belvedere', 'Gunhill', 'Waterfalls', 'Dzivarasekwa', 'Tafara',
        'Mabvuku', 'Sunridge', 'Cranborne', 'Prospect', 'Rugare',
    ];

    protected static array $schoolPrefixes = [
        'Greenwood', 'Sunshine', 'Rainbow', 'Bright Future', 'Excellence',
        'Pioneer', 'Heritage', 'Unity', 'Progress', 'Victory',
        'Liberty', 'Hope', 'Wisdom', 'Knowledge', 'Gateway',
        'Sunrise', 'Star', 'Crown', 'Diamond', 'Golden',
        'Zimbabwe', 'Harare', 'Chitungwiza', 'Borrowdale', 'Highlands',
    ];

    protected static array $schoolSuffixes = [
        'Academy', 'High School', 'Primary School', 'College', 'Institute',
        'Secondary School', 'Junior School', 'Secondary College',
    ];

    protected static array $schoolPositions = [
        'Headmaster', 'Headmistress', 'Deputy Headmaster', 'Deputy Headmistress',
        'Mathematics Teacher', 'English Teacher', 'Science Teacher',
        'History Teacher', 'Geography Teacher', 'Physical Education Teacher',
        'Computer Studies Teacher', 'Shona Teacher', 'Ndebele Teacher',
        'Commerce Teacher', 'Accounts Teacher', 'Biology Teacher',
        'Chemistry Teacher', 'Physics Teacher', 'Art Teacher',
        'School Bursar', 'School Registrar', 'Librarian',
        'School Counsellor', 'Lab Technician', 'IT Technician',
        'School Secretary', 'Caretaker', 'Security Guard',
    ];

    protected static array $departments = [
        'Academic', 'Administration', 'Finance', 'Operations', 'ICT',
        'Arts & Culture', 'Sciences', 'Humanities', 'Physical Education',
    ];

    protected static array $phonePrefixes = ['077', '078', '071', '073'];

    public function zimbabweanFirstName(string $ethnicity = null): string
    {
        if ($ethnicity === 'ndebele') {
            return static::randomElement(static::$ndebeleFirstNames);
        }
        return static::randomElement(static::$shonaFirstNames);
    }

    public function zimbabweanLastName(): string
    {
        return static::randomElement(static::$zimbabweanLastNames);
    }

    public function zimbabweanName(): string
    {
        return $this->zimbabweanFirstName() . ' ' . $this->zimbabweanLastName();
    }

    public function zimbabweanPhone(): string
    {
        $prefix = static::randomElement(static::$phonePrefixes);
        $suffix = static::numerify('#######');
        return "+263{$prefix[1]}{$prefix[2]}{$suffix}";
    }

    public function harareAddress(): string
    {
        $suburb = static::randomElement(static::$harareSuburbs);
        $number = mt_rand(1, 999);
        return "{$number} {$suburb}, Harare, Zimbabwe";
    }

    public function schoolName(): string
    {
        $prefix = static::randomElement(static::$schoolPrefixes);
        $suffix = static::randomElement(static::$schoolSuffixes);
        return "{$prefix} {$suffix}";
    }

    public function schoolPosition(): string
    {
        return static::randomElement(static::$schoolPositions);
    }

    public function department(): string
    {
        return static::randomElement(static::$departments);
    }
}
